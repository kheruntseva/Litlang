const DEFAULT_LOCALE = 'en';

/**
 * Primary language subtag from Accept-Language (first entry, strip q-values).
 * Any 2–10 char a-z/0-9 tag so course locales (fr, es, uk, …) work without a fixed whitelist.
 */
function parsePrimaryLocale(acceptLanguage) {
  const raw = String(acceptLanguage || '')
    .split(',')[0]
    ?.trim()
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  if (!raw) return DEFAULT_LOCALE;
  const primary = raw.split(/[-_]/)[0]?.replace(/[^a-z0-9]/g, '') || '';
  if (primary.length < 2 || primary.length > 10) return DEFAULT_LOCALE;
  return primary.slice(0, 10);
}

/**
 * Parse Accept-Language header and attach req.locale.
 */
function locale(req, _res, next) {
  req.locale = parsePrimaryLocale(req.headers['accept-language'] || '');
  next();
}

module.exports = locale;
