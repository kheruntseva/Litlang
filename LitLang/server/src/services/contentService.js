const db = require('../db/connection');
const { NotFoundError } = require('../utils/errors');
const { paginate } = require('../utils/pagination');

/**
 * Pick a translation row for display: preferred locale, then English, then any non-empty row.
 * Rule and category can use different strategies independently (no single INNER JOIN locale).
 * @param {Array<{ locale: string, title?: string, summary?: string }>} rows
 * @param {string} preferredLocale
 * @returns {{ locale: string, title?: string, summary?: string }|null}
 */
function pickBestTranslation(rows, preferredLocale) {
  const pref = String(preferredLocale || 'en').toLowerCase().slice(0, 10);
  const list = Array.isArray(rows) ? rows : [];
  const nonempty = (r) => {
    const t = String(r?.title || '').trim();
    const s = r.summary !== undefined ? String(r?.summary || '').trim() : '';
    return Boolean(t || s);
  };
  const locEq = (r, code) => String(r?.locale || '').toLowerCase().slice(0, 10) === code;
  return (
    list.find((r) => locEq(r, pref) && nonempty(r))
    || list.find((r) => locEq(r, 'en') && nonempty(r))
    || list.find((r) => nonempty(r))
    || list[0]
    || null
  );
}

/**
 * Get all languages.
 * @returns {Promise<Array>}
 */
async function getLanguages() {
  return db('languages').select('*').orderBy('id');
}

/**
 * Get categories for a language with translations.
 * @param {number} languageId
 * @param {string} locale
 * @param {object} [options]
 * @param {boolean} [options.includeAllTranslations] - if true, each row includes `translations: [{locale,title}]` (admin list)
 * @returns {Promise<Array>}
 */
async function getCategoriesByLanguage(languageId, locale, options = {}) {
  const { includeAllTranslations = false } = options;
  const language = await db('languages').where({ id: languageId }).first();
  if (!language) throw new NotFoundError('Language');

  const categories = await db('categories')
    .where({ language_id: languageId })
    .orderBy('sort_order')
    .select('id', 'slug', 'sort_order');

  if (categories.length === 0) return [];

  const ids = categories.map((c) => c.id);
  const translations = await db('category_translations')
    .whereIn('category_id', ids)
    .select('category_id', 'locale', 'title');

  const byCategory = {};
  for (const t of translations) {
    const cid = Number(t.category_id);
    if (!byCategory[cid]) byCategory[cid] = [];
    byCategory[cid].push({ locale: t.locale, title: t.title });
  }

  const pref = String(locale || 'en').toLowerCase().slice(0, 10);
  return categories.map((c) => {
    const id = Number(c.id);
    const rows = byCategory[id] || [];
    const picked = pickBestTranslation(rows, pref);
    const base = {
      id: c.id,
      slug: c.slug,
      sort_order: c.sort_order,
      language_id: languageId,
      title: picked?.title || '',
      locale: picked?.locale || pref,
    };
    if (includeAllTranslations) {
      base.translations = rows;
    }
    return base;
  });
}

/**
 * Get rules for a category with translations.
 * @param {number} categoryId
 * @param {string} locale
 * @param {object} pagination - { page, limit }
 * @returns {Promise<{data: Array, meta: object}>}
 */
async function getRulesByCategory(categoryId, locale, pagination) {
  const category = await db('categories').where({ id: categoryId }).first();
  if (!category) throw new NotFoundError('Category');

  const rulesQuery = db('rules')
    .where({ category_id: categoryId })
    .orderBy('sort_order')
    .select('id', 'slug', 'sort_order');

  const { data: rulesSlice, meta } = await paginate(rulesQuery, pagination);
  if (rulesSlice.length === 0) {
    return { data: [], meta };
  }

  const ruleIds = rulesSlice.map((r) => r.id);
  const rtRows = await db('rule_translations')
    .whereIn('rule_id', ruleIds)
    .select('rule_id', 'locale', 'title', 'summary');

  const byRule = {};
  for (const row of rtRows) {
    if (!byRule[row.rule_id]) byRule[row.rule_id] = [];
    byRule[row.rule_id].push(row);
  }

  const pref = String(locale || 'en').toLowerCase().slice(0, 10);
  const data = rulesSlice.map((r) => {
    const picked = pickBestTranslation(byRule[r.id] || [], pref);
    return {
      id: r.id,
      slug: r.slug,
      sort_order: r.sort_order,
      title: picked?.title || '',
      summary: picked?.summary || '',
      locale: picked?.locale || pref,
    };
  });

  return { data, meta };
}

/**
 * Get a single rule with translations.
 * @param {number} ruleId
 * @param {string} locale
 * @returns {Promise<object>}
 */
async function getRuleById(ruleId, locale) {
  const pref = String(locale || 'en').toLowerCase().slice(0, 10);

  const row = await db('rules as r')
    .join('categories as c', 'c.id', 'r.category_id')
    .where('r.id', ruleId)
    .select(
      'r.id',
      'r.slug',
      'r.sort_order',
      'r.created_at',
      'r.updated_at',
      'r.category_id',
      'c.language_id'
    )
    .first();

  if (!row) throw new NotFoundError('Rule');

  const rtRows = await db('rule_translations').where({ rule_id: ruleId }).select('locale', 'title', 'summary');
  const rt = pickBestTranslation(rtRows, pref);
  const rtOut = rt || { locale: pref, title: '', summary: '' };

  const ctRows = await db('category_translations')
    .where({ category_id: row.category_id })
    .select('locale', 'title');
  const ct = pickBestTranslation(ctRows, pref);

  return {
    id: row.id,
    slug: row.slug,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    title: rtOut.title,
    summary: rtOut.summary,
    locale: rtOut.locale,
    category_id: row.category_id,
    category_title: ct?.title || '',
    language_id: row.language_id,
  };
}

/**
 * Get excerpts for a rule with book info.
 * @param {number} ruleId
 * @param {object} pagination - { page, limit }
 * @returns {Promise<{data: Array, meta: object}>}
 */
async function getExcerptsByRule(ruleId, pagination) {
  const rule = await db('rules').where({ id: ruleId }).first();
  if (!rule) throw new NotFoundError('Rule');

  const query = db('excerpts as e')
    .join('books as b', 'b.id', 'e.book_id')
    .where('e.rule_id', ruleId)
    .select(
      'e.id', 'e.passage', 'e.highlight', 'e.page_number',
      'e.chapter', 'e.context_note', 'e.sort_order',
      'b.id as book_id', 'b.title as book_title', 'b.author as book_author',
      'b.cover_url as book_cover_url'
    )
    .orderBy('e.sort_order');

  return paginate(query, pagination);
}

/**
 * Get a single excerpt with book info.
 * @param {number} excerptId
 * @returns {Promise<object>}
 */
async function getExcerptById(excerptId) {
  const excerpt = await db('excerpts as e')
    .join('books as b', 'b.id', 'e.book_id')
    .where('e.id', excerptId)
    .select(
      'e.*',
      'b.id as book_id', 'b.title as book_title', 'b.author as book_author',
      'b.cover_url as book_cover_url', 'b.isbn as book_isbn'
    )
    .first();

  if (!excerpt) throw new NotFoundError('Excerpt');
  return excerpt;
}

/**
 * Get all books with optional pagination.
 * @param {object} pagination - { page, limit }
 * @returns {Promise<{data: Array, meta: object}>}
 */
async function getBooks(pagination) {
  const query = db('books').select('*').orderBy('title');
  return paginate(query, pagination);
}

/**
 * Get a single book by ID.
 * @param {number} bookId
 * @returns {Promise<object>}
 */
async function getBookById(bookId) {
  const book = await db('books').where({ id: bookId }).first();
  if (!book) throw new NotFoundError('Book');
  return book;
}

/**
 * Get excerpts for a book with rule info.
 * @param {number} bookId
 * @param {object} pagination - { page, limit }
 * @param {number|undefined} ruleId
 * @returns {Promise<{data: Array, meta: object}>}
 */
async function getExcerptsByBook(bookId, pagination, ruleId) {
  const book = await db('books').where({ id: bookId }).first();
  if (!book) throw new NotFoundError('Book');

  const query = db('excerpts as e')
    .join('rules as r', 'r.id', 'e.rule_id')
    .leftJoin('rule_translations as rt', function () {
      this.on('rt.rule_id', 'r.id').andOn('rt.locale', db.raw('?', ['en']));
    })
    .where('e.book_id', bookId)
    .modify((qb) => {
      if (ruleId) qb.andWhere('e.rule_id', ruleId);
    })
    .select(
      'e.id', 'e.passage', 'e.highlight', 'e.page_number',
      'e.chapter', 'e.context_note', 'e.sort_order',
      'e.rule_id', 'r.slug as rule_slug', 'rt.title as rule_title'
    )
    .orderBy('e.sort_order')
    .orderBy('e.id');

  return paginate(query, pagination);
}

/**
 * Escape % and _ for use in a SQL ILIKE pattern (backslash-escape in PostgreSQL).
 * @param {string} s
 * @returns {string}
 */
function escapeLikePattern(s) {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Search excerpts: full-text (plain) plus substring match on passage / book title / author.
 * @param {string} searchQuery
 * @param {object} pagination - { page, limit }
 * @returns {Promise<{data: Array, meta: object}>}
 */
async function searchExcerpts(searchQuery, pagination) {
  const q = searchQuery.trim();
  if (!q) {
    return paginate(
      db('excerpts as e').whereRaw('1 = 0'),
      pagination
    );
  }

  const likePattern = `%${escapeLikePattern(q)}%`;

  const query = db('excerpts as e')
    .join('books as b', 'b.id', 'e.book_id')
    .where((wb) => {
      wb.whereRaw("to_tsvector('english', e.passage) @@ plainto_tsquery('english', ?)", [q])
        .orWhere('e.passage', 'ilike', likePattern)
        .orWhere('b.title', 'ilike', likePattern)
        .orWhere('b.author', 'ilike', likePattern);
    })
    .select(
      'e.id', 'e.passage', 'e.highlight', 'e.page_number',
      'e.chapter', 'e.rule_id',
      'b.title as book_title', 'b.author as book_author'
    )
    .orderByRaw(
      `(
        COALESCE(
          ts_rank(
            to_tsvector('english', e.passage),
            plainto_tsquery('english', ?)
          ),
          0
        )
      ) DESC, e.id DESC`,
      [q]
    );

  return paginate(query, pagination);
}

module.exports = {
  getLanguages,
  getCategoriesByLanguage,
  getRulesByCategory,
  getRuleById,
  getExcerptsByRule,
  getExcerptsByBook,
  getExcerptById,
  getBooks,
  getBookById,
  searchExcerpts,
};
