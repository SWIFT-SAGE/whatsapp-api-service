import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { StringValue } from 'ms';
import crypto from 'crypto';
import User, { IUser } from '../models/User';
import { EmailOptions } from '../types/common';
import ApiKey from '../models/ApiKey';
import { AppError, ValidationError, AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  phoneNumber?: string;
}

export interface UpdateUserData {
  name?: string;
  phoneNumber?: string;
  avatar?: string;
  settings?: {
    notifications?: {
      email?: boolean;
      push?: boolean;
      webhook?: boolean;
    };
    privacy?: {
      showOnlineStatus?: boolean;
      allowGroupInvites?: boolean;
    };
    preferences?: {
      language?: string;
      timezone?: string;
      theme?: string;
    };
  };
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UserStats {
  totalSessions: number;
  totalMessages: number;
  lastActivity: Date;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResult {
  user: IUser;
  token: string;
  refreshToken: string;
}

interface SubscriptionUpdate {
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

class UserService {
  /**
   * Create a new user account
   */
  async createUser(userData: CreateUserData): Promise<IUser> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new ValidationError('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const user = new User({
        ...userData,
        password: hashedPassword,
        verification: {
          token: verificationToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      await user.save();

      // Send verification email
      await this.sendVerificationEmail(user.email, verificationToken);

      logger.info(`New user created: ${user.email}`);
      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error creating user:', error);
      throw new AppError('Failed to create user account');
    }
  }

  /**
   * Authenticate user login
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      // Find user by email
      const user = await User.findOne({ email: credentials.email }).select('+password');
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if account is active
      if (!user?.active) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Generate tokens
      const token = this.generateAccessToken(user._id.toString());
      const refreshToken = this.generateRefreshToken(user._id.toString());

      // Store refresh token
      (user as any).refreshTokens.push({
        token: refreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
      await user.save();

      logger.info(`User logged in: ${user.email}`);
      return { user, token, refreshToken };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error during login:', error);
      throw new AuthenticationError('Login failed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
      
      // Find user and validate refresh token
      const user = await User.findById(decoded.userId);
      if (!user || !user.active) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const tokenIndex = user.refreshTokens.findIndex(t => t.token === refreshToken && t.expiresAt > new Date());
      if (tokenIndex === -1) {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user._id.toString());
      const newRefreshToken = this.generateRefreshToken(user._id.toString());

      // Replace old refresh token
      user.refreshTokens[tokenIndex] = {
        token: newRefreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };
      await user.save();

      return { token: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error refreshing token:', error);
      throw new AuthenticationError('Token refresh failed');
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Remove refresh token
      user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
      await user.save();

      logger.info(`User logged out: ${user.email}`);
    } catch (error) {
      logger.error('Error during logout:', error);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting user by ID:', error);
      throw new AppError('Failed to retrieve user');
    }
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updateData: UpdateUserData): Promise<IUser> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new NotFoundError('User not found');
      }

      logger.info(`User profile updated: ${user.email}`);
      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating user:', error);
      throw new AppError('Failed to update user profile');
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new ValidationError('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      user.password = hashedNewPassword;
      user.passwordChangedAt = new Date();
      
      // Invalidate all refresh tokens
      user.refreshTokens = [];
      
      await user.save();

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error changing password:', error);
      throw new AppError('Failed to change password');
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<IUser> {
    try {
      const user = await User.findOne({
        'verification.token': token,
        'verification.expiresAt': { $gt: new Date() }
      });

      if (!user) {
        throw new ValidationError('Invalid or expired verification token');
      }

      user.isEmailVerified = true;
      user.verification = undefined;
      await user.save();

      logger.info(`Email verified for user: ${user.email}`);
      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error verifying email:', error);
      throw new AppError('Email verification failed');
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    try {
      const user = await User.findOne({ email, isEmailVerified: false });
      if (!user) {
        throw new NotFoundError('User not found or already verified');
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.verification = {
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
      await user.save();

      // Send verification email
      await this.sendVerificationEmail(email, verificationToken);

      logger.info(`Verification email resent to: ${email}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error resending verification email:', error);
      throw new AppError('Failed to resend verification email');
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if email exists
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordReset = {
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      };
      await user.save();

      // Send reset email
      await this.sendPasswordResetEmail(email, resetToken);

      logger.info(`Password reset requested for: ${email}`);
    } catch (error) {
      logger.error('Error requesting password reset:', error);
      throw new AppError('Failed to process password reset request');
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const user = await User.findOne({
        'passwordReset.token': token,
        'passwordReset.expiresAt': { $gt: new Date() }
      });

      if (!user) {
        throw new ValidationError('Invalid or expired reset token');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password and clear reset token
      user.password = hashedPassword;
      user.passwordChangedAt = new Date();
      user.passwordReset = undefined;
      user.refreshTokens = []; // Invalidate all sessions
      
      await user.save();

      logger.info(`Password reset completed for user: ${user.email}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error resetting password:', error);
      throw new AppError('Password reset failed');
    }
  }

  /**
   * Update user subscription
   */
  async updateSubscription(userId: string, subscriptionData: SubscriptionUpdate): Promise<IUser> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            'subscription.plan': subscriptionData.plan,
            'subscription.stripeCustomerId': subscriptionData.stripeCustomerId,
            'subscription.stripeSubscriptionId': subscriptionData.stripeSubscriptionId,
            'subscription.updatedAt': new Date()
          }
        },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new NotFoundError('User not found');
      }

      logger.info(`Subscription updated for user: ${user.email} to ${subscriptionData.plan}`);
      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating subscription:', error);
      throw new AppError('Failed to update subscription');
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<void> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          isActive: false,
          refreshTokens: [] // Clear all sessions
        }
      );

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Revoke all API keys
      await ApiKey.updateMany(
        { userId },
        { isActive: false }
      );

      logger.info(`User account deactivated: ${user.email}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deactivating user:', error);
      throw new AppError('Failed to deactivate user account');
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<any> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // This would integrate with Analytics model
      const stats = {
        accountCreated: user.createdAt,
        lastLogin: user.lastLoginAt,
        subscriptionPlan: user.subscription.plan,
        emailVerified: user.isVerified,
        // Additional stats would be fetched from Analytics model
      };

      return stats;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting user stats:', error);
      throw new AppError('Failed to retrieve user statistics');
    }
  }

  /**
   * Generate access token
   */
  private generateAccessToken(userId: string): string {
    const secret = process.env.JWT_SECRET || 'default-secret';
    const payload = { userId };
    const expiresIn: StringValue = (process.env.JWT_EXPIRES_IN || '15m') as StringValue;
    const options: jwt.SignOptions = { expiresIn };
    return jwt.sign(payload, secret, options);
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(userId: string): string {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
    const payload = { userId };
    const options: jwt.SignOptions = { expiresIn: '7d' };
    return jwt.sign(payload, refreshSecret, options);
  }

  /**
   * Send verification email
   */
  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    await sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <h1>Verify Your Email Address</h1>
        <p>Please click the link below to verify your email address:</p>
        <p><a href="${verificationUrl}">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
      `
    });
  }

  /**
   * Send password reset email
   */
  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    await sendEmail({
      to: email,
      subject: 'Reset Your Password',
      html: `
        <h1>Reset Your Password</h1>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
      `
    });
  }
}

export default new UserService();