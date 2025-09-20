import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as jwt from 'jsonwebtoken';
import { StringValue } from 'ms';
import crypto from 'crypto';
import User from '../models/User';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';

export class AuthController {
  /**
   * Register new user
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password, name, plan, marketingEmails } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({ error: 'User already exists with this email' });
        return;
      }

      // Create verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Split name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || name;
      const lastName = nameParts.slice(1).join(' ') || 'User';

      // Generate API key
      const generateApiKey = (): string => {
        const prefix = 'am'; // API Messaging
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 15);
        return `${prefix}_${timestamp}_${random}`;
      };

      // Create new user
      const user = new User({
        email,
        password,
        name,
        apiKey: generateApiKey(),
        profile: {
          firstName,
          lastName,
          timezone: 'UTC',
          language: 'en'
        },
        subscription: {
          plan: plan || 'free'
        },
        preferences: {
          emailNotifications: true,
          webhookNotifications: true,
          marketingEmails: marketingEmails || false
        },
        verificationToken,
        isVerified: false
      });

      await user.save();

      // Send verification email (only if SMTP is configured)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const verificationUrl = `${frontendUrl}/auth/verify-email/${verificationToken}`;

      // Check if SMTP is configured before attempting to send email
      const isSmtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST;
      
      if (isSmtpConfigured) {
        // Send email asynchronously without blocking registration
        sendEmail({
          to: email,
          subject: 'Welcome to API Messaging - Verify Your Email',
          html: `
            <h2>Welcome to API Messaging!</h2>
            <p>Hello ${name},</p>
            <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
            <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
            <p>If you didn't create this account, please ignore this email.</p>
            <p>Best regards,<br>API Messaging Team</p>
          `
        }).then(() => {
          logger.info(`Verification email sent to ${email}`);
        }).catch((emailError) => {
          logger.error('Error sending verification email:', emailError);
        });
      } else {
        logger.warn('SMTP not configured, skipping verification email');
      }

      res.status(201).json({
        success: true,
        message: isSmtpConfigured 
          ? 'User registered successfully. Please check your email for verification.'
          : 'User registered successfully. Email verification is not configured.',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          isVerified: user.isVerified,
          subscription: user.subscription
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password } = req.body;

      // Find user with password
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Check password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Generate JWT token
      const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-that-is-at-least-32-characters-long-for-security';
      const payload = { userId: user._id.toString() };
      const expiresIn: StringValue = (process.env.JWT_EXPIRES_IN || '7d') as StringValue;
      const options: jwt.SignOptions = { expiresIn };
      const token = jwt.sign(payload, secret, options);

      logger.info(`Login successful for user: ${email}`);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          isVerified: user.isVerified,
          subscription: user.subscription,
          apiKey: user.apiKey
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'Verification token is required' });
        return;
      }

      const user = await User.findOne({ verificationToken: token });
      if (!user) {
        res.status(400).json({ error: 'Invalid or expired verification token' });
        return;
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  }

  /**
   * Manual verification for testing (temporary)
   */
  async manualVerify(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const user = await User.findOneAndUpdate(
        { email },
        { 
          isVerified: true,
          'subscription.isActive': true,
          'subscription.plan': 'basic'
        },
        { new: true }
      );

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        message: 'User verified and subscription activated',
        user: {
          email: user.email,
          isVerified: user.isVerified,
          apiKey: user.apiKey,
          subscription: user.subscription
        }
      });
    } catch (error) {
      logger.error('Manual verification error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          isVerified: user.isVerified,
          isEmailVerified: user.isEmailVerified,
          subscription: user.subscription,
          apiKey: user.apiKey,
          profile: user.profile,
          preferences: user.preferences,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        }
      });
    } catch (error) {
      logger.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name, phone, company, bio } = req.body;
      const userId = req.user!._id;

      // Prepare update object
      const updateData: any = {};
      if (name) updateData.name = name;
      if (phone !== undefined) updateData['profile.phone'] = phone;
      if (company !== undefined) updateData['profile.company'] = company;
      if (bio !== undefined) updateData['profile.bio'] = bio;

      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          isVerified: user.isVerified,
          isEmailVerified: user.isEmailVerified,
          subscription: user.subscription,
          profile: user.profile,
          preferences: user.preferences,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        }
      });
    } catch (error) {
      logger.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  /**
   * Change password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user!._id;

      // Get user with password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Password change error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if email exists
        res.json({ 
          success: true, 
          message: 'If email exists, password reset link has been sent' 
        });
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();

      // Send reset email
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

      try {
        await sendEmail({
          to: email,
          subject: 'Password Reset - API Messaging',
          html: `
            <h2>Password Reset Request</h2>
            <p>Hello ${user.name},</p>
            <p>You have requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>This link will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>API Messaging Team</p>
          `
        });
      } catch (emailError) {
        logger.error('Error sending reset email:', emailError);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(500).json({ error: 'Failed to send reset email' });
        return;
      }

      res.json({
        success: true,
        message: 'Password reset link sent to your email'
      });
    } catch (error) {
      logger.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process forgot password request' });
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { token, password } = req.body;

      // Hash token and find user
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() }
      });

      if (!user) {
        res.status(400).json({ error: 'Invalid or expired reset token' });
        return;
      }

      // Update password
      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  /**
   * Generate new API key
   */
  async regenerateApiKey(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      user.apiKey = user.generateApiKey();
      await user.save();

      res.json({
        success: true,
        apiKey: user.apiKey,
        message: 'API key regenerated successfully'
      });
    } catch (error) {
      logger.error('API key regeneration error:', error);
      res.status(500).json({ error: 'Failed to regenerate API key' });
    }
  }

  /**
   * Check email configuration status
   */
  async checkEmailConfig(req: Request, res: Response): Promise<void> {
    try {
      const isSmtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST;
      
      res.json({
        success: true,
        emailConfigured: isSmtpConfigured,
        message: isSmtpConfigured 
          ? 'Email service is configured' 
          : 'Email service is not configured. Please set SMTP environment variables.'
      });
    } catch (error) {
      logger.error('Email config check error:', error);
      res.status(500).json({ error: 'Failed to check email configuration' });
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      if (user.isVerified) {
        res.status(400).json({ error: 'Email is already verified' });
        return;
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.verificationToken = verificationToken;
      await user.save();

      // Send verification email
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const verificationUrl = `${frontendUrl}/auth/verify-email/${verificationToken}`;

      try {
        await sendEmail({
          to: user.email,
          subject: 'Verify Your Email - API Messaging',
          html: `
            <h2>Verify Your Email Address</h2>
            <p>Hello ${user.name},</p>
            <p>Please verify your email address by clicking the link below:</p>
            <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>API Messaging Team</p>
          `
        });

        res.json({
          success: true,
          message: 'Verification email sent successfully'
        });
      } catch (emailError) {
        logger.error('Error sending verification email:', emailError);
        
        // Check if SMTP is configured
        const isSmtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS;
        
        if (!isSmtpConfigured) {
          // Return success with verification token for manual verification
          res.json({
            success: true,
            message: 'Email service not configured. Use the verification token below to verify your email manually.',
            verificationToken: verificationToken,
            verificationUrl: verificationUrl
          });
        } else {
          res.status(500).json({ error: 'Failed to send verification email' });
        }
      }
    } catch (error) {
      logger.error('Send verification email error:', error);
      res.status(500).json({ error: 'Failed to send verification email' });
    }
  }

  /**
   * Logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      req.session!.destroy((err) => {
        if (err) {
          logger.error('Logout error:', err);
          res.status(500).json({ error: 'Logout failed' });
          return;
        }
        res.json({ success: true, message: 'Logged out successfully' });
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
}

export default new AuthController();
