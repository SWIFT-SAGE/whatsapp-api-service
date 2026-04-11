import Campaign, { ICampaign, ICampaignRecipient } from '../models/Campaign';
import whatsappService from './whatsappService';
import ContactService from './ContactService';
import { logger } from '../utils/logger';

// In-memory map of running campaign loops so we can pause/cancel them
const runningCampaigns = new Map<string, { cancelled: boolean }>();

class CampaignService {
  /**
   * Create a campaign (status = draft).
   * recipients is array of { phone, name? } OR an array of tag strings
   * to pull contacts from the Contact Book.
   */
  async create(data: {
    userId: string;
    sessionId: string;
    name: string;
    message: string;
    recipients: Array<{ phone: string; name?: string }>;
    mediaUrl?: string;
    caption?: string;
    delayBetweenMessages?: number;
    scheduledAt?: Date;
  }): Promise<ICampaign> {
    if (data.recipients.length === 0) throw new Error('At least one recipient is required');

    const campaign = await Campaign.create({
      userId: data.userId,
      sessionId: data.sessionId,
      name: data.name,
      message: data.message,
      mediaUrl: data.mediaUrl,
      caption: data.caption,
      recipients: data.recipients.map((r) => ({ ...r, status: 'pending' })),
      progress: {
        total: data.recipients.length,
        sent: 0,
        failed: 0,
        skipped: 0,
      },
      delayBetweenMessages: Math.max(data.delayBetweenMessages ?? 3000, 1000),
      scheduledAt: data.scheduledAt,
      status: 'draft',
    });

    logger.info(`Campaign created: ${campaign._id} (${data.recipients.length} recipients)`);
    return campaign;
  }

  /**
   * Create a campaign using contacts from the Contact Book by tag(s).
   */
  async createFromTags(data: {
    userId: string;
    sessionId: string;
    name: string;
    message: string;
    tags: string[];
    mediaUrl?: string;
    caption?: string;
    delayBetweenMessages?: number;
  }): Promise<ICampaign> {
    const { contacts } = await ContactService.list({ userId: data.userId, tags: data.tags, isBlocked: false, limit: 10000 });
    const recipients = contacts.map((c) => ({ phone: c.phone, name: c.name }));
    return this.create({ ...data, recipients });
  }

  async list(userId: string, status?: string, page = 1, limit = 20) {
    const query: any = { userId };
    if (status) query.status = status;
    const [items, total] = await Promise.all([
      Campaign.find(query, { recipients: 0 }) // exclude recipients array for list view
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Campaign.countDocuments(query),
    ]);
    return { items, total };
  }

  async getById(userId: string, campaignId: string): Promise<ICampaign | null> {
    return Campaign.findOne({ _id: campaignId, userId });
  }

  async delete(userId: string, campaignId: string): Promise<boolean> {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) return false;
    if (campaign.status === 'running') throw new Error('Cannot delete a running campaign. Cancel it first.');
    await Campaign.deleteOne({ _id: campaignId });
    return true;
  }

  /**
   * Start sending a draft or paused campaign.
   * Sends messages sequentially with delay to avoid WhatsApp spam detection.
   * Emits progress updates via Socket.io.
   */
  async start(userId: string, campaignId: string): Promise<void> {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) throw new Error('Campaign not found');
    if (!['draft', 'paused'].includes(campaign.status)) {
      throw new Error(`Campaign cannot be started from status: ${campaign.status}`);
    }

    campaign.status = 'running';
    campaign.startedAt = campaign.startedAt || new Date();
    await campaign.save();

    const ctrl = { cancelled: false };
    runningCampaigns.set(campaignId, ctrl);

    // Run asynchronously — don't block the HTTP response
    this._runCampaign(campaign, ctrl).catch((err) => {
      logger.error(`Campaign ${campaignId} runner error:`, err);
    });
  }

  private async _runCampaign(campaign: ICampaign, ctrl: { cancelled: boolean }): Promise<void> {
    const campaignId = campaign._id.toString();
    const userId = campaign.userId.toString();

    for (let i = 0; i < campaign.recipients.length; i++) {
      // Re-check cancel/pause before each message
      if (ctrl.cancelled) {
        await Campaign.findByIdAndUpdate(campaignId, { status: 'cancelled', completedAt: new Date() });
        logger.info(`Campaign ${campaignId} cancelled`);
        runningCampaigns.delete(campaignId);
        return;
      }

      // Re-fetch to check if paused
      const fresh = await Campaign.findById(campaignId).select('status');
      if (fresh?.status === 'paused' || fresh?.status === 'cancelled') {
        runningCampaigns.delete(campaignId);
        logger.info(`Campaign ${campaignId} paused/cancelled mid-run`);
        return;
      }

      const recipient = campaign.recipients[i];
      if (recipient.status !== 'pending') continue; // already processed

      // Check if contact is blocked
      const blocked = await ContactService.isBlocked(userId, recipient.phone);
      if (blocked) {
        recipient.status = 'skipped';
        campaign.progress.skipped++;
      } else {
        try {
          const result = await whatsappService.sendMessage(
            campaign.sessionId,
            recipient.phone,
            campaign.message
          );
          if (result.success) {
            recipient.status = 'sent';
            recipient.sentAt = new Date();
            recipient.messageId = result.messageId;
            campaign.progress.sent++;
          } else {
            recipient.status = 'failed';
            recipient.errorMessage = result.error;
            campaign.progress.failed++;
          }
        } catch (err: any) {
          recipient.status = 'failed';
          recipient.errorMessage = err.message;
          campaign.progress.failed++;
        }
      }

      // Persist progress after each message
      await Campaign.findByIdAndUpdate(campaignId, {
        [`recipients.${i}`]: recipient,
        progress: campaign.progress,
      });

      // Emit real-time progress to the user's socket room
      const io = (global as any).io;
      if (io) {
        io.to(userId).emit('campaign-progress', {
          campaignId,
          progress: campaign.progress,
          currentIndex: i,
        });
      }

      // Delay between messages (except after the last one)
      if (i < campaign.recipients.length - 1) {
        await new Promise((r) => setTimeout(r, campaign.delayBetweenMessages));
      }
    }

    // Mark as completed
    await Campaign.findByIdAndUpdate(campaignId, {
      status: 'completed',
      completedAt: new Date(),
    });

    const ioFinal = (global as any).io;
    if (ioFinal) {
      ioFinal.to(userId).emit('campaign-completed', { campaignId, progress: campaign.progress });
    }

    runningCampaigns.delete(campaignId);
    logger.info(`Campaign ${campaignId} completed`, campaign.progress);
  }

  /** Pause a running campaign */
  async pause(userId: string, campaignId: string): Promise<void> {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'running') throw new Error('Campaign is not running');
    await Campaign.findByIdAndUpdate(campaignId, { status: 'paused' });
    // The runner loop checks status before each message and will exit
  }

  /** Cancel a campaign */
  async cancel(userId: string, campaignId: string): Promise<void> {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) throw new Error('Campaign not found');
    if (['completed', 'cancelled', 'failed'].includes(campaign.status)) {
      throw new Error(`Campaign is already ${campaign.status}`);
    }
    const ctrl = runningCampaigns.get(campaignId);
    if (ctrl) ctrl.cancelled = true;
    await Campaign.findByIdAndUpdate(campaignId, { status: 'cancelled', completedAt: new Date() });
  }
}

export default new CampaignService();
