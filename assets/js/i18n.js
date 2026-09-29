// Page language comes from <html lang>. Workers are started with their page's
// language as the worker name. Anything else (Node tests) falls back to
// Japanese, the original language of the core messages.
function detectLanguage() {
  if (typeof document !== "undefined") return document.documentElement.lang === "en" ? "en" : "ja";
  return globalThis.name === "en" ? "en" : "ja";
}

export const lang = detectLanguage();
export const locale = lang === "ja" ? "ja-JP" : "en-US";

// Each dictionary module exports { ja: {...}, en: {...} } with identical keys.
export function pick(dictionary) {
  return dictionary[lang] || dictionary.ja;
}

// Tool URLs: English lives at the root, Japanese under /ja/.
export function localPath(path) {
  return lang === "ja" ? `/ja${path}` : path;
}
