import mongoose, { Document, Schema } from 'mongoose';

export interface IContact extends Document {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  newsletter: boolean;
  status: 'new' | 'in-progress' | 'resolved' | 'closed';
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot be more than 20 characters']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      enum: {
        values: ['general', 'sales', 'support', 'billing', 'partnership', 'feedback', 'other'],
        message: '{VALUE} is not a valid subject'
      }
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: [10, 'Message must be at least 10 characters'],
      maxlength: [2000, 'Message cannot be more than 2000 characters']
    },
    newsletter: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['new', 'in-progress', 'resolved', 'closed'],
      default: 'new'
    },
    respondedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });

const Contact = mongoose.model<IContact>('Contact', contactSchema);

export default Contact;

