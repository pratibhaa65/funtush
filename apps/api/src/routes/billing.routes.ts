import { Router } from 'express';
import { authenticateWithRefreshToken } from 'src/middleware/refreshTokenAuthentication';
import { checkAgencyStatus } from 'src/middleware/agencyAccess.middleware';
import { db } from '@funtush/database';
import { createStripeSubscription } from '../services/stripeSubscriptionService';
import type { AgencyRequest } from '../types/auth-request';

const router = Router();

// POST /billing/subscribe
router.post(
  '/subscribe',
  authenticateWithRefreshToken,
  checkAgencyStatus,
  async (req: AgencyRequest, res) => {
    try {
      const { subscriptionTierId } = req.body;
      const agencyId = req.agencyId;

      if (!agencyId) {
        return res.status(401).json({ error: 'Agency not found' });
      }

      if (!subscriptionTierId) {
        return res.status(400).json({ error: 'Subscription tier ID is required' });
      }

      // Get agency email
      const agency = await db.agency.findUnique({
        where: { id: agencyId },
      });

      if (!agency) {
        return res.status(404).json({ error: 'Agency not found' });
      }

      // Create Stripe subscription
      const result = await createStripeSubscription(agencyId, agency.email, subscriptionTierId);

      res.json({
        subscriptionId: result.subscription.id,
        clientSecret: result.clientSecret,
      });
    } catch (err) {
      console.error('Subscription creation error:', err);
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  }
);

export default router;