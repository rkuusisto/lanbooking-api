import express from 'express';
import intraService from '../services/intraService.js';

const router = express.Router();

const asyncHandler =
  handler =>
  async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return next(error);
    }
  };

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const record = await intraService.getLatestSetting();
    res.json({ data: record });
  })
);

export default router;
