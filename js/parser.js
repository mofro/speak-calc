/**
 * Converts a spoken utterance into a structured intent.
 * No DOM or speech dependencies — portable to Dart/Flutter.
 *
 * Returns: { intent, params } | null
 *
 * Intents:
 *   tip        { bill, tipPct }
 *   split      { bill, people, tipPct? }
 *   tax        { subtotal, taxPct }
 *   tip_split_tax { bill, tipPct, people, taxPct }
 *   percent    { value, pct }
 *   arithmetic { expr }
 */

export function parse(raw) {
  const text = normalize(raw);

  return (
    tryTipSplitTax(text) ||
    trySplit(text) ||
    tryTip(text) ||
    tryTax(text) ||
    tryPercent(text) ||
    tryArithmetic(text) ||
    null
  );
}

// ── Normalisation ────────────────────────────────────────────────────────────

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/dollars?/g, '')
    .replace(/bucks?/g, '')
    .replace(/percent/g, '%')
    .replace(/gratuity/g, 'tip')
    .replace(/and\s+a\s+half/g, '.5')
    .replace(/\bone\b/g, '1').replace(/\btwo\b/g, '2').replace(/\bthree\b/g, '3')
    .replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5').replace(/\bsix\b/g, '6')
    .replace(/\bseven\b/g, '7').replace(/\beight\b/g, '8').replace(/\bnine\b/g, '9')
    .replace(/\bten\b/g, '10').replace(/\beleven\b/g, '11').replace(/\btwelve\b/g, '12')
    .replace(/\s+/g, ' ')
    .trim();
}

function num(s) {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Matches "15%" or "15 %" anywhere in text — returns value or null
function extractPct(text, label) {
  // label is optional keyword like "tip" or "tax"
  const pattern = label
    ? new RegExp(`${label}[^\\d]*(\\d+(?:\\.\\d+)?)\\s*%`)
    : /(\d+(?:\.\d+)?)\s*%/;
  const m = text.match(pattern);
  return m ? parseFloat(m[1]) : null;
}

function extractMoney(text) {
  const m = text.match(/\$?\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function extractAllMoney(text) {
  return [...text.matchAll(/\$?\s*(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
}

function extractPeople(text) {
  // "3 ways", "3 people", "3 guests", etc.
  let m = text.match(/(\d+)\s*(?:way|person|people|guest|part)/);
  if (m) return parseInt(m[1], 10);
  // "by 3", "divided by 3", "among 3"
  m = text.match(/(?:by|among)\s+(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

// ── Intent parsers ───────────────────────────────────────────────────────────

function tryTipSplitTax(text) {
  if (!(text.includes('tip') || text.match(/%/)) ) return null;
  if (!text.match(/split|way|person|people|divide|among/)) return null;
  if (!text.match(/tax/)) return null;

  const nums = extractAllMoney(text);
  const people = extractPeople(text);
  const tipPct = extractPct(text, 'tip') ?? extractPct(text);
  const taxPct = extractPct(text, 'tax');

  if (!nums.length || !people || tipPct == null || taxPct == null) return null;
  return { intent: 'tip_split_tax', params: { bill: nums[0], tipPct, people, taxPct } };
}

function trySplit(text) {
  if (!text.match(/split|way|divide|each|per\s*person|among/)) return null;

  const bill = extractMoney(text);
  const people = extractPeople(text);
  const tipPct = text.includes('tip') ? extractPct(text) : 0;

  if (bill == null || people == null) return null;
  return { intent: 'split', params: { bill, people, tipPct: tipPct ?? 0 } };
}

function tryTip(text) {
  if (!text.includes('tip')) return null;

  const bill = extractMoney(text);
  const tipPct = extractPct(text) ?? 18; // default 18%

  if (bill == null) return null;
  return { intent: 'tip', params: { bill, tipPct } };
}

function tryTax(text) {
  if (!text.includes('tax')) return null;

  const subtotal = extractMoney(text);
  const taxPct = extractPct(text);

  if (subtotal == null || taxPct == null) return null;
  return { intent: 'tax', params: { subtotal, taxPct } };
}

function tryPercent(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/);
  if (m) return { intent: 'percent', params: { pct: parseFloat(m[1]), value: parseFloat(m[2]) } };

  // "X percent of Y" already handled by normalize turning "percent" → "%"
  return null;
}

function tryArithmetic(text) {
  const expr = text
    .replace(/\bdivided?\s+by\b/g, '/')
    .replace(/\bmultiplied?\s+by\b/g, '*')
    .replace(/\btimes\b/g, '*')
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bover\b/g, '/')
    .replace(/[^\d+\-*/().]/g, '')
    .trim();
  if (expr.length < 2) return null;
  if (!/[\d]/.test(expr)) return null;
  return { intent: 'arithmetic', params: { expr } };
}
