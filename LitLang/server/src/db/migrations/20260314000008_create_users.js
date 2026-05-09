/**
 * @param {import('knex').Knex} knex
 */
exports.up = function (knex) {
  return knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"').then(() => {
    return knex.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('email', 255).unique().notNullable();
      table.string('password_hash', 255).notNullable();
      table.string('display_name', 100).notNullable();
      table.string('role', 20).notNullable().defaultTo('user');
      table.string('preferred_locale', 10).defaultTo('en');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index('email');
    });
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};
