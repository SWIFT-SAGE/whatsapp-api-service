import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Simplified MongoDB connection function
 */
export const connectDatabase = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    logger.error('MONGODB_URI is not defined in .env file');
    process.exit(1);
  }

  try {
    logger.info('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri, {
      family: 4, // Essential for fixing ECONNREFUSED on Windows
    });
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    // Re-throw so the server startup logic in index.ts can handle it
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
};

/**
 * Simple health check
 */
export const isDatabaseHealthy = (): boolean => {
  return mongoose.connection.readyState === 1;
};

// Re-export connection events for logging
mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected');
});
