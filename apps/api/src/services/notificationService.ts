import { smsService } from './smsService';
import { emailService } from './emailService';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface PushNotificationOptions {
  priority?: 'HIGH' | 'NORMAL';
  timeout?: number;
}

class NotificationService {
  private pushTimeoutMs: number;

  constructor() {
    this.pushTimeoutMs = parseInt(process.env.PUSH_TIMEOUT_MS || '5000', 10);
  }

  /**
   * Send notification with fallback chain: Push → SMS
   */
  async sendNotification(
    phoneNumber: string,
    pushToken: string | null,
    message: string,
    options: PushNotificationOptions = {}
  ): Promise<{ success: boolean; method: 'push' | 'sms'; messageId?: string }> {
    const { priority = 'NORMAL' } = options;

    // Try push notification first if token available
    if (pushToken && priority !== 'CRITICAL') {
      try {
        const pushResult = await this.sendPushWithTimeout(pushToken, {
          title: 'Funtush Alert',
          body: message,
        });

        if (pushResult.success) {
          console.log('[NOTIFICATION] Push sent successfully');
          return { success: true, method: 'push', messageId: pushResult.messageId };
        }
      } catch (_error) {
        console.warn('[NOTIFICATION] Push failed, falling back to SMS');
      }
    }

    // Fallback to SMS
    const smsResult = await smsService.sendSMS(phoneNumber, message, {
      priority,
    });

    return {
      success: smsResult.success,
      method: 'sms',
      messageId: smsResult.messageId,
    };
  }

  /**
   * Send critical SOS notification
   */
  async sendSOSNotification(
    phoneNumber: string,
    sosDetails: {
      location: string;
      guideName: string;
      emergencyNumber: string;
      sosType: 'MEDICAL' | 'WEATHER' | 'LOST' | 'MANUAL';
    }
  ): Promise<{ success: boolean; method: 'sms' }> {
    // SOS always sends SMS directly, no push
    const result = await smsService.sendSOSConfirmation(phoneNumber, sosDetails);

    return {
      success: result.success,
      method: 'sms',
    };
  }

  /**
   * Send notification via email
   */
  async sendEmailNotification(
    to: string,
    template: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const result = await emailService.send({
        to,
        subject: `Funtush: ${template}`,
        template,
        data,
      });

      return {
        success: result.success,
        messageId: result.messageId,
      };
    } catch (_error) {
      console.error('[NOTIFICATION] Email send error:', _error instanceof Error ? _error.message : String(_error));
      return { success: false };
    }
  }

  /**
   * Send push notification with timeout
   */
  private async sendPushWithTimeout(
    _token: string,
    _payload: NotificationPayload
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      // Placeholder for actual push implementation (Firebase Cloud Messaging, etc.)
      // For now, return mock result
      console.log('[PUSH] Placeholder - actual implementation needed');

      return {
        success: true,
        messageId: `mock-push-${Date.now()}`,
      };
    } catch (_error) {
      console.error('[PUSH] Error:', _error instanceof Error ? _error.message : String(_error));
      return { success: false };
    }
  }
}

export const notificationService = new NotificationService();