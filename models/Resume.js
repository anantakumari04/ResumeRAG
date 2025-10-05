const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema({
  originalName: String,
  filename: String,
  text: String,
  snippets: [String], // sentences split
  tfidfVector: { type: Object, default: {} }, // saved sparse TF-IDF map
  createdAt: { type: Date, default: Date.now },
  uploadedBy: { type: String, default: 'anonymous' }
});

module.exports = mongoose.model('Resume', ResumeSchema);
