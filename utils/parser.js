const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const extractTextFromFile = async (path, mimeType, originalName) => {
  const ext = (originalName || '').toLowerCase();
  if (mimeType === 'application/pdf' || ext.endsWith('.pdf')) {
    const data = await fs.readFile(path);
    const res = await pdfParse(data);
    return res.text;
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext.endsWith('.docx') || ext.endsWith('.doc')) {
    const res = await mammoth.extractRawText({path});
    return res.value;
  } else {
    // read as text or other
    const t = await fs.readFile(path, 'utf8');
    return t;
  }
};

const splitSentences = (text) => {
  if (!text) return [];
  // naive sentence split
  const bulletsHandled = text.replace(/\r\n/g, '\n').replace(/•/g, '\n-');
  const parts = bulletsHandled.split(/(?<=[.?!])\s+|\n+/g).map(p => p.trim()).filter(Boolean);
  return parts;
};

module.exports = { extractTextFromFile, splitSentences };
