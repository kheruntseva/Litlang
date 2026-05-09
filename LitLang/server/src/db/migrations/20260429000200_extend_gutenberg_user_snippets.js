/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('gutenberg_user_snippets');
  if (!hasTable) return;

  const hasHighlight = await knex.schema.hasColumn('gutenberg_user_snippets', 'highlight');
  if (!hasHighlight) {
    await knex.schema.alterTable('gutenberg_user_snippets', (table) => {
      table.text('highlight').nullable();
      table.string('page_number', 50).nullable();
      table.string('chapter', 200).nullable();
      table.integer('rule_id').unsigned().nullable()
        .references('id').inTable('rules').onDelete('SET NULL');
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable('gutenberg_user_snippets');
  if (!hasTable) return;

  const hasHighlight = await knex.schema.hasColumn('gutenberg_user_snippets', 'highlight');
  if (hasHighlight) {
    await knex.schema.alterTable('gutenberg_user_snippets', (table) => {
      table.dropColumn('highlight');
      table.dropColumn('page_number');
      table.dropColumn('chapter');
      table.dropColumn('rule_id');
    });
  }
};
