import express from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
  res.render('index', { title: 'LanBookingAPI' });
});

/* GET health check - works with or without authentication */
router.get('/api/v1/health', optionalAuth, (req, res) => {
  const response = {
    status: 'ok',
    service: 'lanbooking-api',
    timestamp: new Date().toISOString(),
    message: 'Service is healthy',
    auth: {
      authenticated: req.authenticated || false,
      message: req.authenticated 
        ? 'Authentication is valid' 
        : 'No authentication provided',
    }
  };

  res.json(response);
});

export default router;
