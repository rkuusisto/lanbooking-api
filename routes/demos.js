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
router.get(
  '/matches',
  asyncHandler(async (req, res) => {
    const { tournamentId } = req.query;
    
    if (tournamentId) {
      const matches = await demoService.getDemoMatchesByTournamentPublic(tournamentId);
      return res.json(matches);
    }
    
    const matches = await demoService.getDemoMatchesPublic();
    res.json(matches);
  })
);

// Get full demo data structure with schemaVersion
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await demoService.getDemoDataPublic();
    res.json(data);
  })
);

// Download demo files by match ID
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

    // Defensive check for match.id
    if (!match.id) {
      return res.status(500).json({ error: 'Match ID missing' });
    }

    // Path traversal protection: prevent directory traversal sequences
    if (match.id.includes('..') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const demoFilesDir = '/app/demos';
    const filePath = path.join(demoFilesDir, match.id, filename);
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Generate display name using service helper (already sanitized)
      const downloadFilename = demoService.generateDisplayName(match);
      
      // Log download attempt for auditing and debugging
      console.log(`[${new Date().toISOString()}] INFO: Demo download - id=${id}, filename=${downloadFilename}, sourceFile=${filename}, ip=${req.ip || req.connection?.remoteAddress || 'unknown'}`);
      
      // Set appropriate headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // Use RFC 6266 compliant Content-Disposition header
      // The filename is already sanitized in generateDisplayName, but we still encode it properly
      // Using both filename (ASCII fallback) and filename* (RFC 5987 UTF-8 encoding) for best compatibility
      const asciiFilename = downloadFilename.replace(/[^\x20-\x7E]/g, '_'); // Replace non-ASCII with underscore
      const utf8Filename = encodeURIComponent(downloadFilename).replace(/['()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`
      );
      
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
    const match = await demoService.getDemoMatchByIdPublic(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Demo match not found' });
    }
    return res.json(match);
  })
);

export default router;

