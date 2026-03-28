const mongoose = require('mongoose');

// ──────────────── ADMIN MODEL ────────────────
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ──────────────── RESPONSE MODEL ────────────────
const responseSchema = new mongoose.Schema({
  submittedAt: { type: Date, default: Date.now },

  // Section 01 - Identification
  repondant_nom: String,
  repondant_poste: String,
  repondant_date: String,
  q01_total: Number,
  q01_responsables: Number,
  q01_aides: Number,
  q02: String,
  q03: String,
  q04: String,
  q04_precision: String,

  // Section 02 - Tâches
  q05: [String],
  q05_autre: String,
  q06: [String],
  q06_precision: String,
  q07: [String],
  q07_detail: String,
  q08: mongoose.Schema.Types.Mixed,  // table
  q09: String,

  // Section 03 - Outils
  q10: [String],
  q10_precision: String,
  q11: String,
  q12: mongoose.Schema.Types.Mixed,  // table
  q13: String,
  q14: String,
  q15: Number,
  q15_limitations: String,

  // Section 04 - Automatisation
  q16: mongoose.Schema.Types.Mixed,  // table
  q17: String,
  q17_taches_double: String,
  q18_processus_prioritaires: String,

  // Section 05 - Documents
  q19: mongoose.Schema.Types.Mixed,  // table multi
  q20: String,
  q20_circuit: String,
  q21: String,
  q22: String,
  q23: Number,
  q23_archivage: String,

  // Section 06 - Rapprochements
  q24: mongoose.Schema.Types.Mixed,  // table
  q25: String,
  q25_ecarts: String,
  q26: String,

  // Section 07 - Reporting
  q27: mongoose.Schema.Types.Mixed,  // table
  q28: String,
  q29: String,
  q29_format: String,
  q30: String,
  q30_kpis: String,
  q31: String,

  // Section 08 - Procédures
  q32: String,
  q33: mongoose.Schema.Types.Mixed,  // table
  q34: String,
  q34_controles: String,
  q35: String,

  // Section 09 - Points de Douleur
  q36_sources_perte: String,
  q37_risques: String,
  q38: String,
  q38_detail: String,
  q39: Number,
  q40_remarques: String
}, {
  timestamps: true,
  collection: 'diagnostic_responses'
});

const Admin = mongoose.model('Admin', adminSchema, 'admins');
const DiagnosticResponse = mongoose.model('DiagnosticResponse', responseSchema);

module.exports = { Admin, DiagnosticResponse };
