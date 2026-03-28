require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { Admin, DiagnosticResponse } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me';
const MONGODB_URI = process.env.MONGODB_URI;

// ──────────────── MIDDLEWARE ────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ──────────────── MONGODB CONNECTION ────────────────
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connecté —', MONGODB_URI.split('@')[1]);
    await ensureEssentialDatabase();
  })
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err.message);
    process.exit(1);
  });

// ──────────────── SCHÉMAS / SEED (collections admins + diagnostic_responses) ────────────────
async function ensureEssentialDatabase() {
  try {
    await Admin.syncIndexes();
    await DiagnosticResponse.syncIndexes();
    await seedDefaultAdminIfMissing();
  } catch (err) {
    console.error('Erreur initialisation base:', err.message);
  }
}

/** Si la collection admins est vide, crée l’admin par défaut (variables .env ou défauts). */
async function seedDefaultAdminIfMissing(options = {}) {
  const { verbose = true } = options;
  const count = await Admin.countDocuments();
  if (count > 0) {
    if (verbose) console.log(`ℹ️  Table/collection admins: ${count} compte(s).`);
    return;
  }
  const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase().trim();
  const plainPassword = process.env.ADMIN_PASSWORD || 'Admin@Lean2024';
  const hashed = await bcrypt.hash(plainPassword, 10);
  try {
    await Admin.create({ username, password: hashed });
  } catch (err) {
    if (err.code === 11000) return;
    throw err;
  }
  console.log('✅ Aucun admin en base — seed: compte créé dans `admins`.');
  console.log('   Username:', username);
  console.log('   Password:', plainPassword);
}

// ──────────────── AUTH MIDDLEWARE ────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide.' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token expiré ou invalide.' });
  }
}

// ──────────────── ROUTES PUBLIQUES ────────────────

// Formulaire public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Soumission formulaire
app.post('/api/submit', async (req, res) => {
  try {
    const data = req.body;
    if (!data) return res.status(400).json({ message: 'Données manquantes.' });

    const response = new DiagnosticResponse(data);
    await response.save();

    console.log(`📋 Nouveau diagnostic soumis par: ${data.repondant_nom || 'Anonyme'} le ${new Date().toLocaleString('fr-FR')}`);
    return res.status(201).json({ message: 'Diagnostic enregistré avec succès.', id: response._id });
  } catch (err) {
    console.error('Erreur soumission:', err.message);
    return res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement.' });
  }
});

// ──────────────── ROUTES ADMIN ────────────────

// Entrée secrète → redirection HTTP vers l’interface de login
app.get('/zied', (req, res) => {
  res.redirect(302, '/login');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Dashboard
app.get('/zied/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

// API Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
  }
  try {
    await seedDefaultAdminIfMissing({ verbose: false });

    const admin = await Admin.findOne({ username: username.toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    console.log(`🔐 Connexion admin: ${admin.username} à ${new Date().toLocaleString('fr-FR')}`);
    return res.json({ token, username: admin.username });
  } catch (err) {
    console.error('Erreur login:', err.message);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// GET toutes les réponses (protégé)
app.get('/api/admin/responses', authMiddleware, async (req, res) => {
  try {
    const responses = await DiagnosticResponse.find({}).sort({ submittedAt: -1 }).lean();
    return res.json({ responses, total: responses.length });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des réponses.' });
  }
});

// GET une réponse par ID (protégé)
app.get('/api/admin/responses/:id', authMiddleware, async (req, res) => {
  try {
    const response = await DiagnosticResponse.findById(req.params.id).lean();
    if (!response) return res.status(404).json({ message: 'Réponse introuvable.' });
    return res.json(response);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// DELETE une réponse (protégé)
app.delete('/api/admin/responses/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await DiagnosticResponse.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Réponse introuvable.' });
    console.log(`🗑 Réponse supprimée: ${req.params.id} par ${req.admin.username}`);
    return res.json({ message: 'Réponse supprimée.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// GET statistiques agrégées (protégé)
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const total = await DiagnosticResponse.countDocuments();
    const now = new Date();
    const weekAgo = new Date(now - 7*24*3600*1000);
    const thisWeek = await DiagnosticResponse.countDocuments({ submittedAt: { $gte: weekAgo } });

    // Aggregations
    const erpStats = await DiagnosticResponse.aggregate([
      { $group: { _id: '$q11', count: { $sum: 1 } } }
    ]);
    const priorityStats = await DiagnosticResponse.aggregate([
      { $group: { _id: '$q38', count: { $sum: 1 } } }
    ]);
    const avgSatisfaction = await DiagnosticResponse.aggregate([
      { $group: { _id: null, avg: { $avg: '$q15' }, avgFiabilite: { $avg: '$q39' }, avgArchivage: { $avg: '$q23' } } }
    ]);

    return res.json({
      total,
      thisWeek,
      erpStats,
      priorityStats,
      averages: avgSatisfaction[0] || {}
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur lors du calcul des statistiques.' });
  }
});

// POST créer un nouvel admin (protégé)
app.post('/api/admin/create', authMiddleware, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Champs requis manquants.' });
  }
  try {
    const exists = await Admin.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Cet identifiant existe déjà.' });
    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username: username.toLowerCase(), password: hashed });
    return res.status(201).json({ message: 'Admin créé.', username: admin.username });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ──────────────── 404 FALLBACK ────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route introuvable.' });
});

// ──────────────── START ────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📋 Formulaire public    → http://localhost:${PORT}/`);
  console.log(`🔐 Interface admin      → http://localhost:${PORT}/zied → /login`);
  console.log(`📊 Dashboard admin      → http://localhost:${PORT}/zied/dashboard`);
  console.log(`\n🔑 Identifiants admin par défaut:`);
  console.log(`   Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
  console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@Lean2024'}\n`);
});
