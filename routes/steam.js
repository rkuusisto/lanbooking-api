import express from 'express';
import steamService from '../services/steamService.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

/**
 * GET /api/steam/user/:steamId
 * Fetches Steam user information by Steam ID
 */
router.get(
  '/user/:steamId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { steamId } = req.params;
    const user = await steamService.getUserBySteamId(steamId);
    res.json({
      success: true,
      message: 'Steam user fetched',
      data: user,
    });
  })
);

export default router;

