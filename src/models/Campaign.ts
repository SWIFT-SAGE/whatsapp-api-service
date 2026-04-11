import mongoose, { Schema, Document, Model } from 'mongoose';

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ICampaignRecipient {
  phone: string;
  name?: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sentAt?: Date;
  errorMessage?: string;
  messageId?: string;
}

export interface ICampaign extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  name: string;
  message: string;
  mediaUrl?: string;
  caption?: string;
  recipients: ICampaignRecipient[];
  status: CampaignStatus;
  progress: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  delayBetweenMessages: number;
  startedAt?: Date;
  completedAt?: Date;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recipientSchema = new Schema<ICampaignRecipient>(
  {
    phone:        { type: String, required: true },
    name:         { type: String },
    status:       { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    sentAt:       { type: Date },
    errorMessage: { type: String },
    messageId:    { type: String },
  },
  { _id: false }
);

const campaignSchema = new Schema<ICampaign>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String, required: true },
    name:      { type: String, required: true, trim: true, maxlength: 200 },
    message:   { type: String, required: true, maxlength: 4096 },
    mediaUrl:  { type: String },
    caption:   { type: String, maxlength: 1024 },
    recipients: [recipientSchema],
    status: {
      type: String,
      enum: ['draft', 'running', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'draft',
    },
    progress: {
      total:   { type: Number, default: 0 },
      sent:    { type: Number, default: 0 },
      failed:  { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    delayBetweenMessages: { type: Number, default: 3000, min: 1000 },
    startedAt:   { type: Date },
    completedAt: { type: Date },
    scheduledAt: { type: Date },
  },
  { timestamps: true }
);

campaignSchema.index({ userId: 1 });
campaignSchema.index({ userId: 1, status: 1 });

const Campaign: Model<ICampaign> = mongoose.model<ICampaign>('Campaign', campaignSchema);
export default Campaign;
