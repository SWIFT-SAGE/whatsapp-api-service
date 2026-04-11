import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPhoneContact extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  phone: string;           // E.164 format e.g. +919876543210
  email?: string;
  tags: string[];
  notes?: string;
  isBlocked: boolean;
  customFields: Record<string, string>;
  source: 'manual' | 'csv_import' | 'whatsapp_sync' | 'api';
  createdAt: Date;
  updatedAt: Date;
}

const phoneContactSchema = new Schema<IPhoneContact>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format e.g. +919876543210'],
    },
    email: { type: String, trim: true, lowercase: true },
    tags: [{ type: String }],
    notes: { type: String, maxlength: 1000 },
    isBlocked: { type: Boolean, default: false },
    customFields: { type: Schema.Types.Mixed, default: {} },
    source: {
      type: String,
      enum: ['manual', 'csv_import', 'whatsapp_sync', 'api'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

phoneContactSchema.index({ userId: 1 });
phoneContactSchema.index({ userId: 1, phone: 1 }, { unique: true });
phoneContactSchema.index({ userId: 1, tags: 1 });
phoneContactSchema.index({ userId: 1, isBlocked: 1 });
phoneContactSchema.index({ userId: 1, name: 'text', phone: 'text' });

const PhoneContact: Model<IPhoneContact> = mongoose.model<IPhoneContact>('PhoneContact', phoneContactSchema);
export default PhoneContact;
