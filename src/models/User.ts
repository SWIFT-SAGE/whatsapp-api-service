import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// User interface
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  name: string;
  apiKey: string;
  active: boolean;
  subscription: {
    plan: 'free' | 'basic' | 'premium';
    messageCount: number;
    messageLimit: number;
    isActive: boolean;
    expiresAt?: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    billingCycle: 'monthly' | 'yearly';
    nextBillingDate?: Date;
    cancelAtPeriodEnd: boolean;
  };
  whatsappSessions: mongoose.Types.ObjectId[];
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  passwordChangedAt?: Date;
  passwordReset?: any;
  refreshTokens: Array<{ token: string; createdAt: Date; expiresAt: Date }>;
  isEmailVerified: boolean;
  verification?: any;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  profile: {
    firstName: string;
    lastName: string;
    company?: string;
    phone?: string;
    timezone: string;
    language: string;
  };
  preferences: {
    emailNotifications: boolean;
    webhookNotifications: boolean;
    marketingEmails: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateApiKey(): string;
  canSendMessage(): boolean;
  incrementMessageCount(): Promise<void>;
  resetMessageCount(): Promise<void>;
  isLocked(): boolean;
  incLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
}

// Constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

// User schema
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false,
    validate: {
      validator: function(password: string) {
        // Password must contain at least one uppercase, one lowercase, one number
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  apiKey: {
    type: String,
    unique: true,
    required: true
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free',
      index: true
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    messageLimit: {
      type: Number,
      default: 3 // Free plan limit
    },
    isActive: {
      type: Boolean,
      default: true
    },
    expiresAt: Date,
    stripeCustomerId: {
      type: String,
      sparse: true
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },
    nextBillingDate: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    }
  },
  whatsappSessions: [{
    type: Schema.Types.ObjectId,
    ref: 'WhatsappSession'
  }],
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  verificationToken: {
    type: String,
    sparse: true
  },
  resetPasswordToken: {
    type: String,
    sparse: true
  },
  resetPasswordExpires: Date,
  passwordChangedAt: Date,
  passwordReset: Schema.Types.Mixed,
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    }
  }],
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verification: Schema.Types.Mixed,
  lastLoginAt: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  profile: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [30, 'First name cannot exceed 30 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [30, 'Last name cannot exceed 30 characters']
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    phone: {
      type: String,
      match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'pt', 'it']
    }
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    webhookNotifications: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ apiKey: 1 });
userSchema.index({ 'subscription.plan': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Pre-save middleware to generate API key
userSchema.pre('save', async function(next) {
  if (!this.apiKey) {
    this.apiKey = this.generateApiKey();
  }
  next();
});

// Pre-save middleware to set message limits based on plan
userSchema.pre('save', function(next) {
  if (this.isModified('subscription.plan')) {
    switch (this.subscription.plan) {
      case 'free':
        this.subscription.messageLimit = 3;
        break;
      case 'basic':
        this.subscription.messageLimit = 10000;
        break;
      case 'premium':
        this.subscription.messageLimit = -1; // Unlimited
        break;
    }
  }
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateApiKey = function(): string {
  const prefix = 'am'; // API Messaging
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random}`;
};

userSchema.methods.canSendMessage = function(): boolean {
  if (this.subscription.plan === 'premium') return true;
  return this.subscription.messageCount < this.subscription.messageLimit;
};

userSchema.methods.incrementMessageCount = async function(): Promise<void> {
  if (this.subscription.plan !== 'premium') {
    this.subscription.messageCount += 1;
    await this.save();
  }
};

userSchema.methods.resetMessageCount = async function(): Promise<void> {
  this.subscription.messageCount = 0;
  await this.save();
};

// Account locking methods
userSchema.methods.isLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incLoginAttempts = async function(): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // If we have hit max attempts and it's not locked already, lock the account
  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLoginAt: new Date() }
  });
};

// Static methods
userSchema.statics.findByApiKey = function(apiKey: string) {
  return this.findOne({ apiKey });
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;
