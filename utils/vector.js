const natural = require('natural');
const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

const buildTfidfMap = (documents) => {
  // documents: array of strings
  const tfidf = new TfIdf();
  documents.forEach(doc => tfidf.addDocument(doc || ''));
  // For each doc, create term->weight map
  const maps = [];
  for (let i = 0; i < documents.length; i++) {
    const map = {};
    tfidf.listTerms(i).forEach(item => {
      map[item.term] = item.tfidf;
    });
    maps.push(map);
  }
  return maps;
};

const cosine = (mapA, mapB) => {
  // compute dot / (|A||B|)
  let dot = 0, a2 = 0, b2 = 0;
  for (const [term, w] of Object.entries(mapA)) {
    a2 += w*w;
    if (mapB[term]) dot += w * mapB[term];
  }
  for (const w of Object.values(mapB)) b2 += w*w;
  if (a2 === 0 || b2 === 0) return 0;
  return dot / (Math.sqrt(a2) * Math.sqrt(b2));
};

module.exports = { buildTfidfMap, cosine, tokenizer };
