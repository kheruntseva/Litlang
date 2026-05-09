const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function (knex) {
  await knex('user_progress').del();
  await knex('users').del();

  const adminHash = await bcrypt.hash('admin123', SALT_ROUNDS);
  const userHash = await bcrypt.hash('user123', SALT_ROUNDS);

  await knex('users').insert([
    {
      email: 'admin@litlang.com',
      password_hash: adminHash,
      display_name: 'Admin',
      role: 'admin',
      preferred_locale: 'en',
    },
    {
      email: 'user@litlang.com',
      password_hash: userHash,
      display_name: 'Demo User',
      role: 'user',
      preferred_locale: 'en',
    },
  ]);

  // Seed not_started progress for all rules for every seed user
  const users = await knex('users').select('id');
  const rules = await knex('rules').select('id');
  if (rules.length > 0 && users.length > 0) {
    const progressRows = [];
    for (const user of users) {
      for (const rule of rules) {
        progressRows.push({ user_id: user.id, rule_id: rule.id, status: 'not_started' });
      }
    }
    await knex('user_progress').insert(progressRows).onConflict(['user_id', 'rule_id']).ignore();
  }
};
