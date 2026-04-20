import express from 'express';
import demoService from '../services/demoService.js';
import { requireAuth } from '../middleware/auth.js';

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

// ============================================
// API v1 endpoints for demo parser worker
// All endpoints match the spec at /api/v1/demo-matches/*
// All require authentication
// ============================================

// 1. Create/Update Demo Match (Upsert)
// POST /api/v1/demo-matches
router.post(
  '/demo-matches',
  requireAuth,
  asyncHandler(async (req, res) => {
    const match = await demoService.upsertDemoMatch(req.body);
    return res.status(200).json(match);
  })
);

// 2. Upsert Match Players
// POST /api/v1/demo-matches/:matchId/players
router.post(
  '/demo-matches/:matchId/players',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const result = await demoService.upsertMatchPlayers(matchId, req.body);
    return res.status(200).json(result);
  })
);

// 3. Create Match Rounds
// POST /api/v1/demo-matches/:matchId/rounds
router.post(
  '/demo-matches/:matchId/rounds',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const result = await demoService.createMatchRounds(matchId, req.body);
    return res.status(200).json(result);
  })
);

// 4. Create Round Events
// POST /api/v1/demo-matches/:matchId/rounds/:roundId/events
router.post(
  '/demo-matches/:matchId/rounds/:roundId/events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId, roundId } = req.params;
    const result = await demoService.createRoundEvents(matchId, roundId, req.body);
    return res.status(200).json(result);
  })
);

// 5. Upsert Match Insights
// POST /api/v1/demo-matches/:matchId/insights
router.post(
  '/demo-matches/:matchId/insights',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const result = await demoService.upsertMatchInsights(matchId, req.body);
    return res.status(200).json(result);
  })
);

// 6. Update Match Parse Status
// PATCH /api/v1/demo-matches/:matchId/parse-status
router.patch(
  '/demo-matches/:matchId/parse-status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const result = await demoService.updateMatchParseStatus(matchId, req.body);
    return res.status(200).json(result);
  })
);

export default router;

