import { multiplyPdfTransform } from "./pdf-core.js";

const ROMAN_VALUES = Object.freeze({ I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 });

export function romanToNumber(value) {
  const token = String(value || "").toUpperCase();
  if (!/^[IVXLCDM]+$/.test(token)) return null;
  let total = 0;
  for (let index = 0; index < token.length; index += 1) {
    const current = ROMAN_VALUES[token[index]];
    const next = ROMAN_VALUES[token[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total > 0 && total <= 3999 ? total : null;
}

export function parsePageNumberText(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const explicit = /(?:page|p\.?|頁)\s*([0-9]{1,5})|([0-9]{1,5})\s*(?:ページ|頁)/i.exec(text);
  if (explicit) return { number: Number(explicit[1] || explicit[2]), style: "explicit", strength: 1 };
  const fraction = /(?:^|\D)([0-9]{1,5})\s*(?:\/|of)\s*[0-9]{1,5}(?:\D|$)/i.exec(text);
  if (fraction) return { number: Number(fraction[1]), style: "fraction", strength: 0.96 };
  const plain = /^[\s\-–—_()\[\]·•]*([0-9]{1,5})[\s\-–—_()\[\]·•]*$/.exec(text);
  if (plain) {
    const number = Number(plain[1]);
    if (number >= 1900 && number <= 2099) return null;
    return { number, style: "plain", strength: 0.88 };
  }
  const roman = /^[\s\-–—_()\[\]·•]*([ivxlcdm]{1,8})[\s\-–—_()\[\]·•]*$/i.exec(text);
  if (roman) {
    const number = romanToNumber(roman[1]);
    if (number !== null) return { number, style: "roman", strength: 0.72 };
  }
  return null;
}

export function edgeLocation(x, y, width, height, edgeRatio = 0.18) {
  const nx = x / Math.max(1, width);
  const ny = y / Math.max(1, height);
  const top = ny <= edgeRatio;
  const bottom = ny >= 1 - edgeRatio;
  const left = nx <= edgeRatio;
  const right = nx >= 1 - edgeRatio;
  if (!top && !bottom && !left && !right) return null;
  if (bottom) return { edge: "bottom", zone: nx < 0.3 ? "bottom-left" : nx > 0.7 ? "bottom-right" : "bottom-center", positionScore: nx >= 0.25 && nx <= 0.75 ? 1 : 0.9 };
  if (top) return { edge: "top", zone: nx < 0.3 ? "top-left" : nx > 0.7 ? "top-right" : "top-center", positionScore: nx >= 0.25 && nx <= 0.75 ? 0.93 : 0.84 };
  if (left) return { edge: "left", zone: "left-edge", positionScore: 0.68 };
  return { edge: "right", zone: "right-edge", positionScore: 0.68 };
}

export function pageNumberCandidatesFromText(items, viewportTransform, width, height, edgeRatio = 0.18) {
  const candidates = [];
  for (const item of items || []) {
    if (!item?.str || !Array.isArray(item.transform)) continue;
    const parsed = parsePageNumberText(item.str);
    if (!parsed) continue;
    const transform = multiplyPdfTransform(viewportTransform, item.transform);
    const location = edgeLocation(transform[4], transform[5], width, height, edgeRatio);
    if (!location) continue;
    candidates.push({
      ...parsed,
      ...location,
      raw: String(item.str).trim(),
      x: transform[4] / Math.max(1, width),
      y: transform[5] / Math.max(1, height),
      confidence: parsed.strength * location.positionScore,
      method: "text"
    });
  }
  return candidates;
}

export function resolvePageNumberSequence(candidateLists) {
  const pageCount = candidateLists.length;
  const edgeCounts = new Map();
  const zoneCounts = new Map();
  for (const candidates of candidateLists) {
    for (const edge of new Set(candidates.map(item => item.edge))) edgeCounts.set(edge, (edgeCounts.get(edge) || 0) + 1);
    for (const zone of new Set(candidates.map(item => item.zone))) zoneCounts.set(zone, (zoneCounts.get(zone) || 0) + 1);
  }
  const detections = candidateLists.map(candidates => {
    if (!candidates.length) return null;
    const ranked = candidates.map(candidate => {
      const consistency = (edgeCounts.get(candidate.edge) || 0) / Math.max(1, pageCount);
      const zoneConsistency = (zoneCounts.get(candidate.zone) || 0) / Math.max(1, pageCount);
      const plausible = candidate.number <= Math.max(500, pageCount * 4) ? 0.08 : -0.2;
      return { ...candidate, rank: candidate.confidence + consistency * 0.28 + zoneConsistency * 0.12 + plausible };
    }).sort((a, b) => b.rank - a.rank);
    const chosen = ranked[0];
    return { ...chosen, confidence: Math.max(0, Math.min(1, chosen.confidence * 0.68 + Math.min(1, chosen.rank) * 0.32)) };
  });
  const occurrences = new Map();
  for (const detection of detections) if (detection) {
    const key = `${detection.style === "roman" ? "roman" : "arabic"}:${detection.number}`;
    occurrences.set(key, (occurrences.get(key) || 0) + 1);
  }
  return detections.map(detection => detection ? { ...detection, duplicate: occurrences.get(`${detection.style === "roman" ? "roman" : "arabic"}:${detection.number}`) > 1 } : null);
}

export function sortPagesByDetectedNumber(pages, detections) {
  const prefix = [];
  const groups = [];
  let current = null;
  pages.forEach((page, index) => {
    const detection = detections[index] || null;
    const entry = { page, detection, originalIndex: index };
    if (detection) {
      current = { section: detection.style === "roman" ? 0 : 1, number: detection.number, originalIndex: index, entries: [entry] };
      groups.push(current);
    } else if (current) current.entries.push(entry);
    else prefix.push(entry);
  });
  groups.sort((a, b) => a.section - b.section || a.number - b.number || a.originalIndex - b.originalIndex);
  return [...prefix, ...groups.flatMap(group => group.entries)];
}

export function sequenceIssues(detections) {
  const numbered = detections.filter(Boolean);
  const duplicateLabels = [];
  const gaps = [];
  for (const system of ["roman", "arabic"]) {
    const values = numbered.filter(item => (item.style === "roman" ? "roman" : "arabic") === system).map(item => item.number).sort((a, b) => a - b);
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] === values[index - 1]) duplicateLabels.push(system === "roman" ? `roman ${values[index]}` : values[index]);
      else if (values[index] - values[index - 1] > 1 && values[index] - values[index - 1] <= 20) gaps.push([values[index - 1] + 1, values[index] - 1]);
    }
  }
  return { detected: numbered.length, unresolved: detections.length - numbered.length, duplicates: [...new Set(duplicateLabels)], gaps };
}
