const { Router } = require('express');
const { param, query, body } = require('express-validator');
const validate = require('../../middleware/validate');
const db = require('../../db/connection');
const { paginate } = require('../../utils/pagination');
const { NotFoundError } = require('../../utils/errors');

const router = Router();

// GET /api/v1/admin/users
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['user', 'admin']),
    query('search').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const q = db('users')
        .select('id', 'email', 'display_name', 'role', 'is_active', 'preferred_locale', 'created_at')
        .orderBy('created_at', 'desc');

      if (req.query.role) q.where('role', req.query.role);
      if (req.query.search) {
        q.where(function () {
          this.where('email', 'ilike', `%${req.query.search}%`)
            .orWhere('display_name', 'ilike', `%${req.query.search}%`);
        });
      }

      const result = await paginate(q, { page: req.query.page, limit: req.query.limit });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/admin/users/:id
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid user ID'),
    body('role').optional().isIn(['user', 'admin']),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const updates = {};
      if (req.body.role !== undefined) updates.role = req.body.role;
      if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
      updates.updated_at = db.fn.now();

      const [user] = await db('users')
        .where({ id: req.params.id })
        .update(updates)
        .returning(['id', 'email', 'display_name', 'role', 'is_active']);

      if (!user) throw new NotFoundError('User');
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/admin/users/:id (soft delete)
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid user ID')],
  validate,
  async (req, res, next) => {
    try {
      const [user] = await db('users')
        .where({ id: req.params.id })
        .update({ is_active: false, updated_at: db.fn.now() })
        .returning(['id', 'email', 'is_active']);

      if (!user) throw new NotFoundError('User');
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
