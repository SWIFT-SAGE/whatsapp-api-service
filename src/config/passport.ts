import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import User, { IUser } from '../models/User';
import { logger } from '../utils/logger';
import googleOAuthConfig from './google-oauth';

// Serialize user for session
passport.serializeUser<string>((user: any, done) => {
  done(null, user._id.toString());
});

// Deserialize user from session
passport.deserializeUser<string>(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user as any);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: googleOAuthConfig.clientID,
      clientSecret: googleOAuthConfig.clientSecret,
      callbackURL: googleOAuthConfig.callbackURL,
      scope: googleOAuthConfig.scope,
    },
    async (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
      try {
        logger.info('Google OAuth callback received', {
          profileId: profile.id,
          email: profile.emails?.[0]?.value,
        });

        // Extract user information from Google profile
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;
        const name = profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim();
        const avatar = profile.photos?.[0]?.value;

        if (!email) {
          logger.error('Google OAuth: No email provided in profile');
          return done(new Error('No email provided by Google'), undefined);
        }

        // Check if user exists with this Google ID
        let user = await User.findOne({ googleId });

        if (user) {
          // User exists with this Google ID, update last login
          user.lastLoginAt = new Date();
          if (avatar && !user.avatar) {
            user.avatar = avatar;
          }
          await user.save();
          logger.info('Existing Google user logged in', { userId: user._id, email });
          return done(null, user);
        }

        // Check if user exists with this email (local account)
        user = await User.findOne({ email });

        if (user) {
          // Link Google account to existing local account
          user.googleId = googleId;
          user.authProvider = 'google';
          user.isVerified = true; // Google accounts are pre-verified
          user.isEmailVerified = true;
          user.lastLoginAt = new Date();
          if (avatar && !user.avatar) {
            user.avatar = avatar;
          }
          await user.save();
          logger.info('Linked Google account to existing user', { userId: user._id, email });
          return done(null, user);
        }

        // Create new user with Google account
        const generateApiKey = (): string => {
          const prefix = 'am'; // API Messaging
          const timestamp = Date.now().toString(36);
          const random = Math.random().toString(36).substring(2, 15);
          return `${prefix}_${timestamp}_${random}`;
        };

        // Split name into first and last name
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || name;
        const lastName = nameParts.slice(1).join(' ') || 'User';

        const newUser = new User({
          email,
          name,
          googleId,
          authProvider: 'google',
          avatar,
          apiKey: generateApiKey(),
          isVerified: true, // Google accounts are pre-verified
          isEmailVerified: true,
          lastLoginAt: new Date(),
          profile: {
            firstName,
            lastName,
            timezone: 'UTC',
            language: 'en',
          },
          subscription: {
            plan: 'free',
          },
          preferences: {
            emailNotifications: true,
            webhookNotifications: true,
            marketingEmails: false,
          },
        });

        await newUser.save();
        logger.info('New Google user created', { userId: newUser._id, email });
        return done(null, newUser);
      } catch (error) {
        logger.error('Google OAuth error:', error);
        return done(error as Error, undefined);
      }
    }
  )
);

export default passport;


