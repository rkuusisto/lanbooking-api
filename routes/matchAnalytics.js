/**
 * Match Analytics API Routes
 * 
 * Endpoints for retrieving match analytics data.
 * All responses are cached since match data is historical/immutable.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import matchAnalyticsService from '../services/matchAnalyticsService.js';

const router = express.Router();

// Rate limiting for analytics endpoints
// These endpoints perform computational work, so we limit to prevent abuse
// Allows 100 requests per 15 minutes per IP
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many analytics requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

// Apply rate limiting to all analytics endpoints
router.use(analyticsLimiter);

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Handle caching and response for immutable historical data
 * Computes ETag once and handles conditional requests
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Object} data - Response data for ETag generation
 */
function handleCacheAndResponse(req, res, data) {
  const dataString = JSON.stringify(data);
  const etag = `"${crypto.createHash('md5').update(dataString).digest('hex')}"`;
  
  // Check if client has cached version (304 Not Modified)
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch === etag) {
    return res.status(304).end();
  }
  
  // Cache for 1 hour in browser, 24 hours in shared caches
  // Data is immutable historical stats, so aggressive caching is safe
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.setHeader('ETag', etag);
  res.json(data);
}

// ============================================================================
// Comprehensive Match Analytics
// ============================================================================

/**
 * GET /analytics/matches/:matchId
 * Get complete match analytics summary
 */
router.get(
  '/matches/:matchId',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    const analytics = await matchAnalyticsService.getMatchAnalytics(matchId);
    
    if (!analytics) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    handleCacheAndResponse(req, res, analytics);
  })
);

// ============================================================================
// MVP Endpoints
// ============================================================================

/**
 * GET /analytics/matches/:matchId/mvp
 * Get match MVP analysis
 */
router.get(
  '/matches/:matchId/mvp',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    const mvps = await matchAnalyticsService.getMatchMVPs(matchId);
    
    if (!mvps) {
      return res.status(404).json({ error: 'Match not found or no player data' });
    }
    
    handleCacheAndResponse(req, res, mvps);
  })
);

/**
 * GET /analytics/matches/:matchId/rounds/mvp
 * Get round-by-round MVP breakdown
 */
router.get(
  '/matches/:matchId/rounds/mvp',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    const roundMVPs = await matchAnalyticsService.getRoundMVPs(matchId);
    
    if (!roundMVPs) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    handleCacheAndResponse(req, res, roundMVPs);
  })
);

// ============================================================================
// Highlights Endpoints
// ============================================================================

/**
 * GET /analytics/matches/:matchId/highlights
 * Get match highlights (clutches, aces, multi-kills, etc.)
 */
router.get(
  '/matches/:matchId/highlights',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 15;
    
    const highlights = await matchAnalyticsService.getMatchHighlights(matchId, limit);
    
    if (!highlights) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    handleCacheAndResponse(req, res, highlights);
  })
);

// ============================================================================
// Player Progression Endpoints
// ============================================================================

/**
 * GET /analytics/matches/:matchId/progression
 * Get player progression analysis (improvement/decline throughout match)
 */
router.get(
  '/matches/:matchId/progression',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    const progressions = await matchAnalyticsService.getPlayerProgressions(matchId);
    
    if (!progressions) {
      return res.status(404).json({ error: 'Match not found or no player data' });
    }
    
    handleCacheAndResponse(req, res, progressions);
  })
);

/**
 * GET /analytics/matches/:matchId/progression/:steamId
 * Get progression report for a specific player
 */
router.get(
  '/matches/:matchId/progression/:steamId',
  asyncHandler(async (req, res) => {
    const { matchId, steamId } = req.params;
    
    const progression = await matchAnalyticsService.getPlayerProgressionReport(matchId, steamId);
    
    if (!progression) {
      return res.status(404).json({ error: 'Match or player not found' });
    }
    
    handleCacheAndResponse(req, res, progression);
  })
);

// ============================================================================
// Team Analytics Endpoints
// ============================================================================

/**
 * GET /analytics/matches/:matchId/teams
 * Get team-based analytics
 */
router.get(
  '/matches/:matchId/teams',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    const teamAnalytics = await matchAnalyticsService.getTeamAnalytics(matchId);
    
    if (!teamAnalytics) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    handleCacheAndResponse(req, res, teamAnalytics);
  })
);

// ============================================================================
// Weapon Statistics Endpoints
// ============================================================================

/**
 * GET /analytics/matches/:matchId/weapons
 * Get weapon usage and kill statistics
 */
router.get(
  '/matches/:matchId/weapons',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    const weaponStats = await matchAnalyticsService.getWeaponStats(matchId);
    
    if (!weaponStats) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    handleCacheAndResponse(req, res, weaponStats);
  })
);

// ============================================================================
// Opening Duel Endpoints
// ============================================================================

/**
 * GET /analytics/matches/:matchId/opening-duels
 * Get opening duel (first kill) statistics
 */
router.get(
  '/matches/:matchId/opening-duels',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    const openingDuelStats = await matchAnalyticsService.getOpeningDuelStats(matchId);
    
    if (!openingDuelStats) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    handleCacheAndResponse(req, res, openingDuelStats);
  })
);

// ============================================================================
// Trade Kill Analysis Endpoints
// ============================================================================

/**
 * GET /analytics/matches/:matchId/trades
 * Get trade kill analysis
 */
router.get(
  '/matches/:matchId/trades',
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    const tradeAnalysis = await matchAnalyticsService.getTradeAnalysis(matchId);
    
    if (!tradeAnalysis) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    handleCacheAndResponse(req, res, tradeAnalysis);
  })
);

// ============================================================================
// Cache Management (Admin)
// ============================================================================

/**
 * GET /analytics/cache/stats
 * Get cache statistics
 */
router.get(
  '/cache/stats',
  asyncHandler(async (req, res) => {
    const stats = matchAnalyticsService.getCacheStats();
    res.json(stats);
  })
);

/**
 * DELETE /analytics/cache/:matchId
 * Invalidate cache for a specific match
 * Requires authentication
 */
router.delete(
  '/cache/:matchId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    matchAnalyticsService.invalidateMatchCache(matchId);
    res.json({ success: true, message: `Cache invalidated for match ${matchId}` });
  })
);

/**
 * DELETE /analytics/cache
 * Clear entire analytics cache
 * Requires authentication
 */
router.delete(
  '/cache',
  requireAuth,
  asyncHandler(async (req, res) => {
    matchAnalyticsService.clearCache();
    res.json({ success: true, message: 'Analytics cache cleared' });
  })
);

export default router;




