/**
 * Safe positive integer id for URL paths. Rejects "", null, NaN, and the literal strings "undefined"/"null"
 * (which are truthy in JS and previously produced /languages/undefined/... requests).
 * @param {unknown} v
 * @returns {string|null}
 */
export function parseApiId(v) {
  if (v === '' || v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === 'undefined' || s === 'null' || s === 'NaN') return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

/**
 * Accept-Language for content APIs: use the course language code, not the UI (i18n) language,
 * so admin lists/dropdowns show titles in the language being edited (e.g. French).
 */
export function acceptLanguageForCourse(languages, languageId) {
  const key = parseApiId(languageId);
  const lang = key ? languages.find((l) => String(l.id) === key) : null;
  const code = String(lang?.code || 'en')
    .trim()
    .toLowerCase()
    .slice(0, 10);
  return { headers: { 'Accept-Language': code || 'en' } };
}
