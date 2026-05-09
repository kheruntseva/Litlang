const SUPPORTED_LOCALES = ['en', 'ru'];
const DEFAULT_LOCALE = 'en';

/**
 * Parse Accept-Language header and attach req.locale.
 */
function locale(req, _res, next) {
  const acceptLanguage = req.headers['accept-language'] || '';
  const requested = acceptLanguage.split(',')[0]?.trim().substring(0, 2).toLowerCase();
  req.locale = SUPPORTED_LOCALES.includes(requested) ? requested : DEFAULT_LOCALE;
  next();
}

module.exports = locale;
