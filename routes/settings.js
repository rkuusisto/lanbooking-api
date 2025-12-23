import express from 'express';
import intraService from '../services/intraService.js';

const router = express.Router();

function sendFailure(msg, res) {
  res.status(400).send({
    success: 'false',
    message: msg,
  });
}

router.get('/settings', async (req, res) => {
    const record = await intraService.getLatestSetting();
    res.json({ data: record });
});

export default router;

