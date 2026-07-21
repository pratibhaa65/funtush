import express from 'express';
import { emailService } from '../services/emailService';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * POST /emails/inquiry-received
 */
router.post('/inquiry-received', authenticate, async (req, res) => {
  try {
    const { to, firstName, trekName, inquiryId, trackingUrl } = req.body;

    const result = await emailService.sendInquiryReceived(to, {
      firstName,
      trekName,
      inquiryId,
      trackingUrl,
    });

    res.json(result);
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Email send failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /emails/booking-confirmed
 */
router.post('/booking-confirmed', authenticate, async (req, res) => {
  try {
    const {
      to,
      firstName,
      bookingId,
      trekName,
      startDate,
      duration,
      guide,
      itineraryPdfUrl,
      dashboardUrl,
      totalPrice,
    } = req.body;

    const result = await emailService.sendBookingConfirmed(to, {
      firstName,
      bookingId,
      trekName,
      startDate,
      duration,
      guide,
      itineraryPdfUrl,
      dashboardUrl,
      totalPrice,
    });

    res.json(result);
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Email send failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /emails/payment-link
 */
router.post('/payment-link', authenticate, async (req, res) => {
  try {
    const { to, firstName, bookingId, trekName, amount, paymentUrl, dueDate } =
      req.body;

    const result = await emailService.sendPaymentLink(to, {
      firstName,
      bookingId,
      trekName,
      amount,
      paymentUrl,
      dueDate,
    });

    res.json(result);
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Email send failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /emails/trek-reminder
 */
router.post('/trek-reminder', authenticate, async (req, res) => {
  try {
    const {
      to,
      firstName,
      trekName,
      startDate,
      departureTime,
      meetingLocation,
      guidePhone,
      checklist,
    } = req.body;

    const result = await emailService.sendTrekReminder(to, {
      firstName,
      trekName,
      startDate,
      departureTime,
      meetingLocation,
      guidePhone,
      checklist,
    });

    res.json(result);
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Email send failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /emails/guide-contact
 */
router.post('/guide-contact', authenticate, async (req, res) => {
  try {
    const { to, trekkerName, trekName, guideName, guidePhone, guideEmail } =
      req.body;

    const result = await emailService.sendGuideContact(to, {
      trekkerName,
      trekName,
      guideName,
      guidePhone,
      guideEmail,
    });

    res.json(result);
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Email send failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /emails/review-invitation
 */
router.post('/review-invitation', authenticate, async (req, res) => {
  try {
    const { to, firstName, trekName, completionDate, reviewUrl } = req.body;

    const result = await emailService.sendReviewInvitation(to, {
      firstName,
      trekName,
      completionDate,
      reviewUrl,
    });

    res.json(result);
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Email send failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /emails/sos-notification
 */
router.post('/sos-notification', authenticate, async (req, res) => {
  try {
    const { to, sosType, location, trekName, guideName, timestamp } = req.body;

    const result = await emailService.sendSOSNotification(to, {
      sosType,
      location,
      trekName,
      guideName,
      timestamp,
    });

    res.json(result);
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Email send failed';
    res.status(500).json({ error: message });
  }
});

export default router;