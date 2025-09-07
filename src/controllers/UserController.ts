import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/User';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/common';

export class UserController {
  /**
   * Get user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      
      const user = await User.findById(userId)
        .select('-password -verificationToken -resetPasswordToken')
        .populate('whatsappSessions', 'sessionId isConnected phoneNumber');

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting user profile:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ApiResponse);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id;
      const { name, email } = req.body;

      // Check if email is already taken by another user
      if (email && email !== req.user!.email) {
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
          res.status(409).json({
            success: false,
            message: 'Email already in use'
          } as ApiResponse);
          return;
        }
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { name, email },
        { new: true, runValidators: true }
      ).select('-password -verificationToken -resetPasswordToken');

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      } as ApiResponse);

    } catch (error) {
      logger.error('Error updating user profile:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ApiResponse);
    }
  }

  /**
   * Get user subscription details
   */
  async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      
      const user = await User.findById(userId).select('subscription');
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Subscription details retrieved successfully',
        data: user.subscription
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting subscription details:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ApiResponse);
    }
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        } as ApiResponse);
        return;
      }

      const newApiKey = user.generateApiKey();
      await user.save();

      logger.info(`API key regenerated for user: ${user.email}`);

      res.json({
        success: true,
        message: 'API key regenerated successfully',
        data: { apiKey: newApiKey }
      } as ApiResponse);

    } catch (error) {
      logger.error('Error regenerating API key:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ApiResponse);
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      
      // Delete user and all associated data
      await User.findByIdAndDelete(userId);
      
      // Note: In production, you might want to soft delete and clean up associated data
      // like WhatsApp sessions, message logs, etc.
      
      logger.info(`User account deleted: ${req.user!.email}`);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      } as ApiResponse);

    } catch (error) {
      logger.error('Error deleting user account:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ApiResponse);
    }
  }
}

export default new UserController();