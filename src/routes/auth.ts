import express from 'express';
import { body } from 'express-validator';
import AuthController from '../controllers/authController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('name').isLength({ min: 2 }).withMessage('Name must be at least 2 characters long')
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
];

const updateProfileValidation = [
  body('name').isLength({ min: 2 }).withMessage('Name must be at least 2 characters long')
];

const resetPasswordValidation = [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('token').notEmpty().withMessage('Reset token is required')
];

// Public routes
router.post('/register', registerValidation, AuthController.register);
router.post('/login', loginValidation, AuthController.login);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, AuthController.resetPassword);

// Protected routes
router.use(authenticateToken);
router.get('/profile', AuthController.getProfile);
router.put('/profile', updateProfileValidation, AuthController.updateProfile);
router.post('/change-password', changePasswordValidation, AuthController.changePassword);
router.post('/regenerate-api-key', AuthController.regenerateApiKey);
router.post('/logout', AuthController.logout);

export default router;
