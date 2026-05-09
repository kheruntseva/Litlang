const db = require('../db/connection');
const { NotFoundError } = require('../utils/errors');

/**
 * Get favourites for a user.
 * @param {string} userId
 * @param {object} filters - { target_type }
 * @returns {Promise<Array>}
 */
async function getUserFavourites(userId, filters = {}) {
  const query = db('favourites as f')
    .leftJoin('books as b', function () {
      this.on('b.id', 'f.target_id').andOn('f.target_type', db.raw('?', ['book']));
    })
    .leftJoin('excerpts as e', function () {
      this.on('e.id', 'f.target_id').andOn('f.target_type', db.raw('?', ['excerpt']));
    })
    .leftJoin('rules as r', function () {
      this.on('r.id', 'f.target_id').andOn('f.target_type', db.raw('?', ['rule']));
    })
    .leftJoin('rule_translations as rt', function () {
      this.on('rt.rule_id', 'r.id').andOn('rt.locale', db.raw('?', ['en']));
    })
    .leftJoin('gutenberg_user_snippets as gus', function () {
      this.on('gus.id', 'f.target_id').andOn('f.target_type', db.raw('?', ['gutenberg_snippet']));
    })
    .leftJoin('books as gb', 'gb.id', 'gus.book_id')
    .leftJoin('rules as gr', 'gr.id', 'gus.rule_id')
    .leftJoin('rule_translations as grt', function () {
      this.on('grt.rule_id', 'gr.id').andOn('grt.locale', db.raw('?', ['en']));
    })
    .where('f.user_id', userId)
    .andWhere((qb) => {
      // Hide broken favourites for deleted books.
      qb.whereNot('f.target_type', 'book').orWhereNotNull('b.id');
    })
    .select(
      'f.*',
      'b.title as book_title',
      'b.author as book_author',
      'e.passage as excerpt_passage',
      'rt.title as rule_title',
      'gus.passage as gutenberg_snippet_passage',
      'gus.highlight as gutenberg_snippet_highlight',
      'gus.page_number as gutenberg_snippet_page_number',
      'gus.chapter as gutenberg_snippet_chapter',
      'gus.context_note as gutenberg_snippet_context_note',
      'gus.rule_id as gutenberg_snippet_rule_id',
      'gb.title as gutenberg_book_title',
      'gb.author as gutenberg_book_author',
      'gr.slug as gutenberg_rule_slug',
      'grt.title as gutenberg_rule_title',
      'grt.summary as gutenberg_rule_summary'
    )
    .orderBy('f.created_at', 'desc');

  if (filters.target_type) {
    query.where('f.target_type', filters.target_type);
  }

  return query;
}

/**
 * Add to favourites.
 * @param {string} userId
 * @param {string} targetType - rule | excerpt
 * @param {number} targetId
 * @returns {Promise<object>}
 */
async function addFavourite(userId, targetType, targetId) {
  const [favourite] = await db('favourites')
    .insert({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    })
    .onConflict(['user_id', 'target_type', 'target_id'])
    .ignore()
    .returning('*');

  if (!favourite) {
    // Already exists, return existing
    return db('favourites')
      .where({ user_id: userId, target_type: targetType, target_id: targetId })
      .first();
  }

  return favourite;
}

/**
 * Remove from favourites.
 * @param {string} userId
 * @param {number} favouriteId
 * @returns {Promise<void>}
 */
async function removeFavourite(userId, favouriteId) {
  const deleted = await db('favourites')
    .where({ id: favouriteId, user_id: userId })
    .del();

  if (!deleted) {
    throw new NotFoundError('Favourite');
  }
}

module.exports = { getUserFavourites, addFavourite, removeFavourite };
