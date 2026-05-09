/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('rule_translations', (table) => {
    table.increments('id').primary();
    table.integer('rule_id').unsigned().notNullable()
      .references('id').inTable('rules').onDelete('CASCADE');
    table.string('locale', 10).notNullable();
    table.string('title', 300).notNullable();
    table.text('summary').notNullable();

    table.unique(['rule_id', 'locale']);
    table.index('rule_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('rule_translations');
};
