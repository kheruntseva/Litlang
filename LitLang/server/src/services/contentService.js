const db = require('../db/connection');
const { NotFoundError } = require('../utils/errors');
const { paginate } = require('../utils/pagination');

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
 * @returns {Promise<Array>}
 */
async function getCategoriesByLanguage(languageId, locale) {
  const language = await db('languages').where({ id: languageId }).first();
  if (!language) throw new NotFoundError('Language');

  return db('categories as c')
    .join('category_translations as ct', function () {
      this.on('ct.category_id', 'c.id').andOn('ct.locale', db.raw('?', [locale]));
    })
    .where('c.language_id', languageId)
    .select('c.id', 'c.slug', 'c.sort_order', 'ct.title', 'ct.locale')
    .orderBy('c.sort_order');
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

  const query = db('rules as r')
    .join('rule_translations as rt', function () {
      this.on('rt.rule_id', 'r.id').andOn('rt.locale', db.raw('?', [locale]));
    })
    .where('r.category_id', categoryId)
    .select('r.id', 'r.slug', 'r.sort_order', 'rt.title', 'rt.summary', 'rt.locale')
    .orderBy('r.sort_order');

  return paginate(query, pagination);
}

/**
 * Get a single rule with translations.
 * @param {number} ruleId
 * @param {string} locale
 * @returns {Promise<object>}
 */
async function getRuleById(ruleId, locale) {
  const rule = await db('rules as r')
    .join('rule_translations as rt', function () {
      this.on('rt.rule_id', 'r.id').andOn('rt.locale', db.raw('?', [locale]));
    })
    .join('categories as c', 'c.id', 'r.category_id')
    .join('category_translations as ct', function () {
      this.on('ct.category_id', 'c.id').andOn('ct.locale', db.raw('?', [locale]));
    })
    .where('r.id', ruleId)
    .select(
      'r.id', 'r.slug', 'r.sort_order', 'r.created_at', 'r.updated_at',
      'rt.title', 'rt.summary', 'rt.locale',
      'c.id as category_id', 'ct.title as category_title',
      'c.language_id'
    )
    .first();

  if (!rule) throw new NotFoundError('Rule');
  return rule;
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
