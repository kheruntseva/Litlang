/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('languages', (table) => {
    table.increments('id').primary();
    table.string('code', 10).unique().notNullable();
    table.string('name', 100).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('languages');
};
