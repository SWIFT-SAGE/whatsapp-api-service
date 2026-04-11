import mongoose, { Schema, Document, Model } from 'mongoose';

export type ScheduledMessageStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface IScheduledMessage extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  to: string;
  message: string;
  mediaUrl?: string;
  caption?: string;
  scheduledAt: Date;
  status: ScheduledMessageStatus;
  sentAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledMessageSchema = new Schema<IScheduledMessage>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId:    { type: String, required: true },
    to:           { type: String, required: true, match: [/^\+[1-9]\d{6,14}$/, 'E.164 format required'] },
    message:      { type: String, required: true, maxlength: 4096 },
    mediaUrl:     { type: String },
    caption:      { type: String, maxlength: 1024 },
    scheduledAt:  { type: Date, required: true },
    status:       { type: String, enum: ['pending', 'sent', 'failed', 'cancelled'], default: 'pending' },
    sentAt:       { type: Date },
    errorMessage: { type: String },
    retryCount:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

scheduledMessageSchema.index({ userId: 1 });
scheduledMessageSchema.index({ status: 1, scheduledAt: 1 });
scheduledMessageSchema.index({ userId: 1, status: 1 });

const ScheduledMessage: Model<IScheduledMessage> = mongoose.model<IScheduledMessage>(
  'ScheduledMessage',
  scheduledMessageSchema
);
export default ScheduledMessage;
