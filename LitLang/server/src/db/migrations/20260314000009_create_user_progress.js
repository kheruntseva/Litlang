/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.createTable('user_progress', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('rule_id').unsigned().notNullable()
      .references('id').inTable('rules').onDelete('CASCADE');
    table.string('status', 20).notNullable().defaultTo('not_started');
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['user_id', 'rule_id']);
    table.index('user_id');
    table.index('rule_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('user_progress');
};
