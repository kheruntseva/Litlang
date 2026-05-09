/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('gutenberg_user_snippets');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('gutenberg_user_snippets', 'context_note');
  if (!hasColumn) {
    await knex.schema.alterTable('gutenberg_user_snippets', (table) => {
      table.text('context_note').nullable();
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable('gutenberg_user_snippets');
  if (!hasTable) return;
  const hasColumn = await knex.schema.hasColumn('gutenberg_user_snippets', 'context_note');
  if (hasColumn) {
    await knex.schema.alterTable('gutenberg_user_snippets', (table) => {
      table.dropColumn('context_note');
    });
  }
};
