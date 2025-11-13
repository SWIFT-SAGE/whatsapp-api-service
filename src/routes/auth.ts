import express from 'express';
import { body } from 'express-validator';
import passport from '../config/passport';
import AuthController from '../controllers/authController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('name').isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('plan').optional().isIn(['free', 'basic', 'premium']).withMessage('Plan must be free, basic, or premium'),
  body('marketingEmails').optional().isBoolean().withMessage('Marketing emails must be a boolean value')
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
  body('name').optional().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('phone').optional().matches(/^\+?[1-9]\d{1,14}$/).withMessage('Please provide a valid phone number'),
  body('company').optional().isLength({ max: 100 }).withMessage('Company name cannot exceed 100 characters'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters')
];

const resetPasswordValidation = [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('token').notEmpty().withMessage('Reset token is required')
];

// Public routes
router.post('/register', registerValidation, AuthController.register);
router.post('/login', loginValidation, AuthController.login);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/manual-verify', AuthController.manualVerify); // Temporary for testing
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, AuthController.resetPassword);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login?error=auth_failed',
    session: false
  }),
  AuthController.googleAuthCallback
);

// Protected routes
router.use(authenticateToken);
router.get('/profile', AuthController.getProfile);
router.put('/profile', updateProfileValidation, AuthController.updateProfile);
router.post('/change-password', changePasswordValidation, AuthController.changePassword);
router.post('/generate-api-key', AuthController.generateApiKey);
router.post('/regenerate-api-key', AuthController.regenerateApiKey);
router.get('/email-config', AuthController.checkEmailConfig);
router.post('/send-verification-email', AuthController.sendVerificationEmail);
router.post('/logout', AuthController.logout);

export default router;
