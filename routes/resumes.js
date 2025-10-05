const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const Resume = require('../models/Resume');
const { extractTextFromFile, splitSentences } = require('../utils/parser');
const { redactPII } = require('../utils/redact');
const { v4: uuidv4 } = require('uuid');
const natural = require('natural');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});

// Accept any file field to prevent Multer Unexpected field errors
const upload = multer({ storage }).any();

const router = express.Router();

// POST /api/resumes - single or ZIP upload
router.post('/', (req, res) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ error: 'Multer error', details: err.message });
        }
        return res.status(500).json({ error: 'Upload failed', details: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'file missing' });
      }

      const created = [];
      for (const file of req.files) {
        if (file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip')) {
          const zip = new AdmZip(file.path);
          const entries = zip.getEntries().filter(e => !e.isDirectory);

          for (const entry of entries) {
            const ext = path.extname(entry.entryName).toLowerCase();
            if (!['.pdf', '.docx', '.doc', '.txt'].includes(ext)) continue;

            const tempName = uuidv4() + ext;
            const outPath = path.join(uploadDir, tempName);
            zip.extractEntryTo(entry.entryName, uploadDir, false, true, tempName);

            const text = await extractTextFromFile(outPath, null, entry.entryName);
            const snippets = splitSentences(text);

            const r = new Resume({ originalName: entry.entryName, filename: tempName, text, snippets });
            await r.save();
            created.push({ id: r._id, originalName: r.originalName });
          }
        } else {
          const text = await extractTextFromFile(file.path, file.mimetype, file.originalname);
          const snippets = splitSentences(text);

          const r = new Resume({ originalName: file.originalname, filename: file.filename, text, snippets });
          await r.save();
          created.push({ id: r._id, originalName: r.originalName });
        }
      }

      res.json({ created });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'upload failed', details: error.message });
    }
  });
});

// GET /api/resumes?limit=&offset=&q=
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit || '10'));
    const offset = parseInt(req.query.offset || '0');
    const q = req.query.q;

    if (!q) {
      const docs = await Resume.find().sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
      return res.json({
        total: await Resume.countDocuments(),
        resumes: docs.map(r => ({ id: r._id, originalName: r.originalName, createdAt: r.createdAt }))
      });
    }

    const regex = new RegExp(q.split(/\s+/).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'ig');
    const all = await Resume.find().lean();
    const scored = all.map(r => {
      const matches = (r.text || '').match(regex);
      const score = matches ? matches.length : 0;
      return { r, score };
    }).filter(x => x.score > 0).sort((a,b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.r.createdAt - a.r.createdAt !== 0) return b.r.createdAt - a.r.createdAt;
      return a.r._id.toString().localeCompare(b.r._id.toString());
    });
    const sliced = scored.slice(offset, offset + limit).map(x => ({ id: x.r._id, originalName: x.r.originalName, score: x.score}));
    res.json({ total: scored.length, resumes: sliced });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/resumes/:id
router.get('/:id', async (req,res) => {
  try {
    const id = req.params.id;
    const isRecruiter = (req.get('x-role') || '').toLowerCase() === 'recruiter';
    const r = await Resume.findById(id).lean();
    if(!r) return res.status(404).json({error:'not found'});
    const text = isRecruiter ? r.text : redactPII(r.text, false);
    res.json({ id: r._id, originalName: r.originalName, text, createdAt: r.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resumes/ask {query, k}
router.post('/ask', async (req,res) => {
  try {
    const { query, k = 3 } = req.body || {};
    if (!query) return res.status(400).json({ error: 'missing query' });

    const all = await Resume.find().lean();
    const docs = all.map(a => a.text || '');
    const TfIdf = natural.TfIdf;
    const tfidf = new TfIdf();
    docs.forEach(d => tfidf.addDocument(d || ''));

    const results = all.map((r, idx) => {
      const tokens = query.split(/\s+/).map(t => t.toLowerCase());
      let score = 0;
      tokens.forEach(tok => {
        const terms = tfidf.listTerms(idx);
        const match = terms.find(t => t.term === tok);
        if (match) score += match.tfidf;
      });
      return { r, idx, score };
    }).filter(x => x.score > 0).sort((a,b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.r.createdAt - a.r.createdAt !== 0) return b.r.createdAt - a.r.createdAt;
      return a.r._id.toString().localeCompare(b.r._id.toString());
    }).slice(0, k);

    const qtokens = query.split(/\s+/).map(t=>t.replace(/[^\w]/g,'').toLowerCase()).filter(Boolean);
    const isRecruiter = (req.get('x-role') || '').toLowerCase() === 'recruiter';

    const answers = results.map(({r}) => {
      const snippets = (r.snippets || []).filter(s => {
        const sl = s.toLowerCase();
        return qtokens.some(qt => sl.includes(qt));
      }).slice(0,3);
      const evidence = snippets.map(s => isRecruiter ? s : redactPII(s, false));
      return {
        resumeId: r._id,
        score: Math.round((r.text ? r.text.length : 0) * 1000 / 1000) / 1000, // placeholder
        evidence
      };
    });

    res.json({
      query,
      results: answers,
      metadata: { total_resumes: all.length }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
