const redactPII = (text, isRecruiter=false) => {
  if (!text) return '';
  if (isRecruiter) return text;
  let t = text;
  // emails
  t = t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[REDACTED_EMAIL]');
  // phone numbers (simple)
  t = t.replace(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g, '[REDACTED_PHONE]');
  // SSN-like
  t = t.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  // Very simple name redaction: common honorifics + capitalized words followed by capitalized
  // (this is conservative)
  t = t.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g, (m) => {
    // skip short words, months, skills
    if (m.length > 2 && m.split(' ').length <= 2) return '[REDACTED_NAME]';
    return m;
  });
  return t;
};

module.exports = { redactPII };
