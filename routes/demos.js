import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import demoService from '../services/demoService.js';

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

// Get all demo matches or matches by tournament
// Returns array of matches (frontend-compatible format)
router.get(
  '/matches',
  asyncHandler(async (req, res) => {
    const { tournamentId } = req.query;
    
    if (tournamentId) {
      const matches = await demoService.getDemoMatchesByTournament(tournamentId);
      return res.json(matches);
    }
    
    const matches = await demoService.getDemoMatches();
    res.json(matches);
  })
);

// Get full demo data structure (with schemaVersion)
// Matches README schema format
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await demoService.getDemoData();
    res.json(data);
  })
);

// Download handler for demo files
// Uses match ID for indirect file access (prevents path traversal) and friendly download names
// Serves files from Docker volume mapped to DEMO_FILES_DIR (default: /app/demos)
router.get(
  '/d/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Missing demo match ID' });
    }

    // Sanitize ID: must be alphanumeric with underscores, hyphens, and dots
    if (
      typeof id !== 'string' ||
      !/^[A-Za-z0-9_.-]+$/.test(id)
    ) {
      return res.status(400).json({ error: 'Invalid match ID' });
    }

    // Look up match by ID to get the filename
    const match = await demoService.getDemoMatchById(id);
    if (!match) {
      return res.status(404).json({ error: 'Demo match not found' });
    }

    if (!match.fileName) {
      return res.status(404).json({ error: 'Demo file name not found for this match' });
    }

    // Sanitize filename from database: must be alphanumeric with underscores/hyphens/dots, and end in .dem
    const filename = match.fileName;
    if (!/^[A-Za-z0-9_.-]+\.dem$/.test(filename)) {
      return res.status(400).json({ error: 'Demo file unavailable' });
    }

    const demoFilesDir = process.env.DEMO_FILES_DIR || '/app/demos';
    const filePath = path.join(demoFilesDir, filename);

    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Generate display name using service helper
      const downloadFilename = demoService.generateDisplayName(match);
      
      // Set appropriate headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      
      // Send the file
      return res.sendFile(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Demo file not found' });
      }
      throw error;
    }
  })
);

// Get single demo match by ID
router.get(
  '/matches/:id',
  asyncHandler(async (req, res) => {
    const match = await demoService.getDemoMatchById(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Demo match not found' });
    }
    return res.json(match);
  })
);

// Create new demo match
router.post(
  '/matches',
  asyncHandler(async (req, res) => {
    const matchData = req.body ?? {};
    const match = await demoService.createDemoMatch(matchData);
    res.status(201).json(match);
  })
);

// Update demo match
router.put(
  '/matches/:id',
  asyncHandler(async (req, res) => {
    const matchData = req.body ?? {};
    const match = await demoService.updateDemoMatch(req.params.id, matchData);
    if (!match) {
      return res.status(404).json({ error: 'Demo match not found' });
    }
    return res.json(match);
  })
);

// Delete demo match
router.delete(
  '/matches/:id',
  asyncHandler(async (req, res) => {
    const deleted = await demoService.deleteDemoMatch(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Demo match not found' });
    }
    return res.status(204).send();
  })
);

export default router;

