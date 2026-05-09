const { Router } = require('express');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const contentService = require('../services/contentService');

const router = Router();

// GET /api/v1/excerpts/:id
router.get(
  '/:id',
  [param('id').isInt().withMessage('Excerpt ID must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const excerpt = await contentService.getExcerptById(parseInt(req.params.id, 10));
      res.json({ data: excerpt });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
