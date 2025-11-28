import express from 'express';
import intraService from '../services/intraService.js';
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

// Registrations
router.get(
  '/registrations',
  asyncHandler(async (req, res) => {
    const data = await intraService.getRegistrations();
    res.json({ data });
  })
);

router.get(
  '/registrations/:id',
  asyncHandler(async (req, res) => {
    const record = await intraService.getRegistrationById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    return res.json({ data: record });
  })
);

router.post(
  '/registrations',
  asyncHandler(async (req, res) => {
    const payload = req.body ?? {};
    const record = await intraService.createRegistration(payload);
    res.status(201).json({ data: record });
  })
);

router.put(
  '/registrations/:id',
  asyncHandler(async (req, res) => {
    const payload = req.body ?? {};
    const record = await intraService.updateRegistration(
      req.params.id,
      payload
    );
    if (!record) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    return res.json({ data: record });
  })
);

router.delete(
  '/registrations/:id',
  asyncHandler(async (req, res) => {
    const deleted = await intraService.deleteRegistration(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    return res.status(204).send();
  })
);

// Bookings
router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const data = await intraService.getBookings();
    res.json({ data });
  })
);

router.get(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    const record = await intraService.getBookingById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    return res.json({ data: record });
  })
);

router.post(
  '/bookings',
  asyncHandler(async (req, res) => {
    const payload = req.body ?? {};
    const record = await intraService.createBooking(payload);
    res.status(201).json({ data: record });
  })
);

router.put(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    const payload = req.body ?? {};
    const record = await intraService.updateBooking(req.params.id, payload);
    if (!record) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    return res.json({ data: record });
  })
);

router.patch(
  '/bookings/:id/billing',
  asyncHandler(async (req, res) => {
    if (typeof req.body?.done === 'undefined') {
      return res
        .status(400)
        .json({ error: 'done field is required to update billing status' });
    }
    const record = await intraService.updateBooking(req.params.id, {
      done: req.body.done,
    });
    if (!record) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    return res.json({ data: record });
  })
);

router.delete(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    const deleted = await intraService.deleteBooking(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    return res.status(204).send();
  })
);

// Settings
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const data = await intraService.getSettings();
    res.json({ data });
  })
);

router.get(
  '/settings/current',
  asyncHandler(async (req, res) => {
    const record = await intraService.getLatestSetting();
    if (!record) {
      return res.status(404).json({ error: 'No settings found' });
    }
    return res.json({ data: record });
  })
);

router.get(
  '/settings/:id',
  asyncHandler(async (req, res) => {
    const record = await intraService.getSettingById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Settings entry not found' });
    }
    return res.json({ data: record });
  })
);

router.post(
  '/settings',
  asyncHandler(async (req, res) => {
    const record = await intraService.createSetting(req.body ?? {});
    res.status(201).json({ data: record });
  })
);

router.put(
  '/settings/:id',
  asyncHandler(async (req, res) => {
    const record = await intraService.updateSetting(
      req.params.id,
      req.body ?? {}
    );
    if (!record) {
      return res.status(404).json({ error: 'Settings entry not found' });
    }
    return res.json({ data: record });
  })
);

router.delete(
  '/settings/:id',
  asyncHandler(async (req, res) => {
    const deleted = await intraService.deleteSetting(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Settings entry not found' });
    }
    return res.status(204).send();
  })
);

// Demo Matches (admin operations)
router.post(
  '/demos/matches',
  asyncHandler(async (req, res) => {
    const matchData = req.body ?? {};
    
    // Validate required fields
    if (!matchData.tournamentId || !matchData.team1 || !matchData.team2) {
      return res.status(400).json({ 
        error: 'Missing required fields: tournamentId, team1, and team2 are required' 
      });
    }
    
    const match = await demoService.createDemoMatch(matchData);
    res.status(201).json({ data: match });
  })
);

router.put(
  '/demos/matches/:id',
  asyncHandler(async (req, res) => {
    const matchData = req.body ?? {};
    const match = await demoService.updateDemoMatch(req.params.id, matchData);
    if (!match) {
      return res.status(404).json({ error: 'Demo match not found' });
    }
    return res.json({ data: match });
  })
);

router.delete(
  '/demos/matches/:id',
  asyncHandler(async (req, res) => {
    const deleted = await demoService.deleteDemoMatch(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Demo match not found' });
    }
    return res.status(204).send();
  })
);

export default router;
