// Ranking for the header search. Pure functions so they can be tested in Node.
// Matches tool names, everyday phrasing ("画像を軽くしたい"), word pairs
// ("余白" + "消す") and the direction of format conversions ("PNGをSVGに").
import { SEARCH_ENTRIES } from "./site-search-data.js";

const MIN_SCORE = 20;

// Full-width to half-width, lower case, katakana to hiragana.
export function normalizeQuery(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/\s+/g, " ")
    .trim();
}

// Japanese has no spaces between words, so most matching is done on a compact
// form without spaces, punctuation or common particles, applied to both the
// query and the catalog: "PDFを結合" matches "PDF結合", "余白消したい" matches "余白を消".
function compact(text) {
  return normalizeQuery(text).replace(/[\s・、。,.!?！？「」『』()（）:：;；"'“”‘’\-–—>→⇒/をがにへのは]/g, "");
}

const words = text => normalizeQuery(text).split(/[^a-z0-9぀-鿿]+/).filter(Boolean);
// Japanese and English lists often share terms ("pdf"); count each once.
const allLanguages = value => (value ? [...new Set(Object.values(value).flat())] : []);

function firstIndex(haystack, terms, from = 0) {
  let best = -1;
  for (const term of terms) {
    const index = haystack.indexOf(compact(term), from);
    if (index >= 0 && (best < 0 || index < best)) best = index;
  }
  return best;
}

// "png を svg に": a source format followed by a target format.
// The reverse order ("svg を png に") means a different tool.
function conversionScore(query, convert) {
  if (!convert) return 0;
  const from = firstIndex(query, convert.from);
  if (from >= 0 && firstIndex(query, convert.to, from + 1) > from) return 80;
  const to = firstIndex(query, convert.to);
  if (to >= 0 && firstIndex(query, convert.from, to + 1) > to) return -60;
  return 0;
}

export function scoreEntry(entry, rawQuery) {
  const query = compact(rawQuery);
  if (!query) return 0;
  const queryWords = words(rawQuery).filter(word => word.length >= 3);
  let score = 0;

  for (const name of allLanguages(entry.name)) {
    const target = compact(name);
    if (target === query) score = Math.max(score, 200);
    else if (query.length >= 2 && target.includes(query)) score = Math.max(score, 120);
    else if (target.length >= 2 && query.includes(target)) score = Math.max(score, 100);
  }

  for (const keyword of allLanguages(entry.keywords)) {
    const target = compact(keyword);
    if (!target) continue;
    if (query.includes(target)) score += 30 + target.length * 3;
    else if (query.length >= 2 && target.startsWith(query)) score += 15;
  }

  for (const word of queryWords) {
    for (const text of [...allLanguages(entry.name), ...allLanguages(entry.keywords)]) {
      if (words(text).some(token => token.startsWith(word))) { score += 8; break; }
    }
  }

  for (const combo of entry.combos || []) {
    for (const groups of Object.values(combo)) {
      if (groups.every(group => group.some(term => query.includes(compact(term))))) score += 60;
    }
  }

  if (query.length >= 2 && allLanguages(entry.description).some(text => compact(text).includes(query))) score += 10;
  score += conversionScore(query, entry.convert);
  return score;
}

export function searchSite(rawQuery, { limit = 6, entries = SEARCH_ENTRIES } = {}) {
  return entries
    .map((entry, order) => ({ entry, order, score: scoreEntry(entry, rawQuery) }))
    .filter(result => result.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(result => result.entry);
}
