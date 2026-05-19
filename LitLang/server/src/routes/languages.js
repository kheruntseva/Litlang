const { Router } = require('express');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const contentService = require('../services/contentService');

const router = Router();

// GET /api/v1/languages
router.get('/', async (_req, res, next) => {
  try {
    const languages = await contentService.getLanguages();
    res.json({ data: languages });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/languages/:id/categories
router.get(
  '/:id/categories',
  [param('id').isInt().withMessage('Language ID must be an integer')],
  validate,
  async (req, res, next) => {
    try {
      const includeAll = String(req.query.all || '') === '1';
      const categories = await contentService.getCategoriesByLanguage(
        parseInt(req.params.id, 10),
        req.locale,
        { includeAllTranslations: includeAll }
      );
      res.json({ data: categories });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
