import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { validateDemoMatch } from '../middleware/validateDemoMatch.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import demoService from '../services/demoService.js';

const router = express.Router();

// Rate limiting for demo parser endpoints
// Allows 100 requests per 15 minutes per IP
const demoParserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for bulk operations (players, rounds, events)
const bulkOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Too many bulk operations from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /demo-matches/{matchId}:
 *   get:
 *     summary: Get a demo match by ID
 *     tags: [Demo Parser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *         description: The match ID
 *     responses:
 *       200:
 *         description: Demo match retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Match not found
 *       429:
 *         description: Too many requests
 */
router.get(
  '/demo-matches/:matchId',
  demoParserLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    
    if (!matchId) {
      return res.status(400).json({ error: 'Match ID is required' });
    }
    
    const match = await demoService.getDemoMatchById(matchId);
    
    if (!match) {
      return res.status(404).json({ error: 'Demo match not found' });
    }
    
    // Generate ETag from match data for conditional requests
    const matchString = JSON.stringify(match);
    const etag = crypto.createHash('md5').update(matchString).digest('hex');
    const etagHeader = `"${etag}"`;
    
    // Check if client has cached version
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etagHeader) {
      return res.status(304).end(); // Not Modified
    }
    
    // Set cache headers for relatively static match data (5 minutes)
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', etagHeader);
    
    // Set Last-Modified if match has updatedAt timestamp
    if (match.updatedAt) {
      res.setHeader('Last-Modified', new Date(match.updatedAt).toUTCString());
    }
    
    return res.status(200).json(match);
  })
);

/**
 * @swagger
 * /demo-matches:
 *   post:
 *     summary: Create or update a demo match (upsert)
 *     tags: [Demo Parser]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - tournamentId
 *               - event
 *               - stage
 *               - fileName
 *               - fileSizeMB
 *               - map
 *               - bestOf
 *               - playedAt
 *               - teams
 *             properties:
 *               id:
 *                 type: string
 *               tournamentId:
 *                 type: string
 *               event:
 *                 type: string
 *               stage:
 *                 type: string
 *               fileName:
 *                 type: string
 *               fileSizeMB:
 *                 type: number
 *               map:
 *                 type: string
 *               bestOf:
 *                 type: integer
 *               playedAt:
 *                 type: string
 *                 format: date-time
 *               teams:
 *                 type: string
 *               parseStatus:
 *                 type: string
 *                 enum: [pending, processing, completed, failed]
 *               parseError:
 *                 type: string
 *     responses:
 *       200:
 *         description: Demo match created or updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 */
router.post(
  '/demo-matches',
  demoParserLimiter,
  requireAuth,
  validateDemoMatch,
  asyncHandler(async (req, res) => {
    const matchData = req.body;
    const match = await demoService.upsertDemoMatch(matchData);
    res.status(200).json(match);
  })
);

/**
 * @swagger
 * /demo-matches/{matchId}/players:
 *   post:
 *     summary: Create or update match players (upsert)
 *     tags: [Demo Parser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *               - type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Players created or updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Match not found
 *       429:
 *         description: Too many requests
 */
router.post(
  '/demo-matches/:matchId/players',
  bulkOperationLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const playersData = req.body;
    
    if (!playersData) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    
    const result = await demoService.upsertMatchPlayers(matchId, playersData);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /demo-matches/{matchId}/rounds:
 *   post:
 *     summary: Create match rounds
 *     tags: [Demo Parser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *               - type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Rounds created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Match not found
 *       429:
 *         description: Too many requests
 */
router.post(
  '/demo-matches/:matchId/rounds',
  bulkOperationLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const roundsData = req.body;
    
    if (roundsData === undefined || roundsData === null) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    
    const result = await demoService.createMatchRounds(matchId, roundsData);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /demo-matches/{matchId}/rounds/{roundId}/events:
 *   post:
 *     summary: Create round events
 *     tags: [Demo Parser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *               - type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Events created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Match or round not found
 *       429:
 *         description: Too many requests
 */
router.post(
  '/demo-matches/:matchId/rounds/:roundId/events',
  bulkOperationLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId, roundId } = req.params;
    const eventsData = req.body;
    
    if (!eventsData) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    
    const result = await demoService.createRoundEvents(matchId, roundId, eventsData);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /demo-matches/{matchId}/insights:
 *   post:
 *     summary: Create or update match insights (upsert)
 *     tags: [Demo Parser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Insights created or updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Match not found
 *       429:
 *         description: Too many requests
 */
router.post(
  '/demo-matches/:matchId/insights',
  demoParserLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const insightsData = req.body;
    
    if (!insightsData || typeof insightsData !== 'object') {
      return res.status(400).json({ error: 'Request body must be an object' });
    }
    
    const result = await demoService.upsertMatchInsights(matchId, insightsData);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /demo-matches/{matchId}/parse-status:
 *   patch:
 *     summary: Update match parse status
 *     tags: [Demo Parser]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - parseStatus
 *             properties:
 *               parseStatus:
 *                 type: string
 *                 enum: [pending, processing, completed, failed]
 *               parseError:
 *                 type: string
 *     responses:
 *       200:
 *         description: Parse status updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Match not found
 *       429:
 *         description: Too many requests
 */
router.patch(
  '/demo-matches/:matchId/parse-status',
  demoParserLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;
    const statusData = req.body;
    
    if (!statusData || !statusData.parseStatus) {
      return res.status(400).json({ 
        error: 'parseStatus is required',
        details: 'Request body must include parseStatus field'
      });
    }
    
    const result = await demoService.updateMatchParseStatus(matchId, statusData);
    res.status(200).json(result);
  })
);

export default router;

