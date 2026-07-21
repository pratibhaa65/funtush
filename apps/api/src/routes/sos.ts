import express, { type Request, type Response } from 'express';
import { emergencyService } from '../services/emergencyService';
import { authenticate } from '../middleware/auth';
import { db } from '@funtush/database';

const router = express.Router();

/**
 * POST /sos/trigger
 * Trigger SOS event
 */
router.post('/trigger', authenticate, async (req: Request, res: Response) => {
  try {
    const { trekId, sosType, location, notes } = req.body;
    const userId = (req.user as { id: string })?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!trekId || !sosType || !location) {
      return res.status(400).json({
        error: 'trekId, sosType, and location are required',
      });
    }

    // Validate guide is on trek
    const trek = await db.trek.findUnique({
      where: { id: trekId },
    });

    if (!trek) {
      return res.status(404).json({ error: 'Trek not found' });
    }

    if (trek.guideId !== userId) {
      return res.status(403).json({ error: 'Not authorized to trigger SOS for this trek' });
    }

    // Trigger SOS
    await emergencyService.triggerSOS({
      trekId,
      guiderId: userId,
      trekkerIds: trek.trekkerIds || [],
      sosType: sosType as 'MEDICAL' | 'WEATHER' | 'LOST' | 'MANUAL',
      location,
      notes,
    });

    res.json({
      success: true,
      message: 'SOS activated. Emergency services notified.',
    });
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'SOS trigger failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /sos/:sosId/cancel
 * Cancel active SOS
 */
router.post('/:sosId/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const userId = (req.user as { id: string })?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    if (!req.params.sosId) {
      return res.status(400).json({ error: 'sosId is required' });
    }

    await emergencyService.cancelSOS(req.params.sosId, reason);

    res.json({ success: true, message: 'SOS cancelled' });
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Failed to cancel SOS';
    res.status(500).json({ error: message });
  }
});

export default router;