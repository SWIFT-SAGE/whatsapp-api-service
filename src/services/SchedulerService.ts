import cron from 'node-cron';
import ScheduledMessage, { IScheduledMessage } from '../models/ScheduledMessage';
import whatsappService from './whatsappService';
import { logger } from '../utils/logger';

const MAX_RETRY = 2;

class SchedulerService {
  private task: cron.ScheduledTask | null = null;

  /**
   * Start the scheduler — polls every 30 seconds for due messages.
   * Call this once after the database is connected.
   */
  start(): void {
    if (this.task) return; // already running

    // Every 30 seconds
    this.task = cron.schedule('*/30 * * * * *', () => {
      this.processDueMessages().catch((err) =>
        logger.error('SchedulerService error:', err)
      );
    });

    logger.info('SchedulerService started — polling every 30 seconds');
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
    logger.info('SchedulerService stopped');
  }

  private async processDueMessages(): Promise<void> {
    const now = new Date();

    // Fetch all pending messages whose scheduledAt is in the past
    const due: IScheduledMessage[] = await ScheduledMessage.find({
      status: 'pending',
      scheduledAt: { $lte: now },
    }).limit(50); // process at most 50 per tick

    if (due.length === 0) return;

    logger.info(`SchedulerService: processing ${due.length} due message(s)`);

    for (const msg of due) {
      try {
        const result = await whatsappService.sendMessage(
          msg.sessionId,
          msg.to,
          msg.message
        );

        if (result.success) {
          msg.status = 'sent';
          msg.sentAt = new Date();
        } else {
          msg.retryCount += 1;
          msg.errorMessage = result.error;
          msg.status = msg.retryCount >= MAX_RETRY ? 'failed' : 'pending';
          // Retry after 5 minutes if not exhausted
          if (msg.status === 'pending') {
            msg.scheduledAt = new Date(Date.now() + 5 * 60 * 1000);
          }
        }
      } catch (err: any) {
        msg.retryCount += 1;
        msg.errorMessage = err.message;
        msg.status = msg.retryCount >= MAX_RETRY ? 'failed' : 'pending';
        if (msg.status === 'pending') {
          msg.scheduledAt = new Date(Date.now() + 5 * 60 * 1000);
        }
        logger.error(`SchedulerService failed to send message ${msg._id}:`, err);
      }

      await msg.save();
    }
  }

  /** Create a new scheduled message */
  async schedule(data: {
    userId: string;
    sessionId: string;
    to: string;
    message: string;
    scheduledAt: Date;
    mediaUrl?: string;
    caption?: string;
  }): Promise<IScheduledMessage> {
    if (data.scheduledAt <= new Date()) {
      throw new Error('scheduledAt must be in the future');
    }
    return ScheduledMessage.create(data);
  }

  /** List scheduled messages for a user */
  async list(userId: string, status?: string, page = 1, limit = 20) {
    const query: any = { userId };
    if (status) query.status = status;
    const [items, total] = await Promise.all([
      ScheduledMessage.find(query)
        .sort({ scheduledAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ScheduledMessage.countDocuments(query),
    ]);
    return { items, total };
  }

  /** Cancel a pending scheduled message */
  async cancel(userId: string, messageId: string): Promise<IScheduledMessage | null> {
    return ScheduledMessage.findOneAndUpdate(
      { _id: messageId, userId, status: 'pending' },
      { status: 'cancelled' },
      { new: true }
    );
  }
}

export default new SchedulerService();
