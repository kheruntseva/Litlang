/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('favourites', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('target_type', 20).notNullable();
    table.integer('target_id').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['user_id', 'target_type', 'target_id']);
    table.index('user_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('favourites');
};
