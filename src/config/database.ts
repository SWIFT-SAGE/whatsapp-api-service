import mongoose from 'mongoose';
import { logger } from '../utils/logger';

// Database configuration interface
interface DatabaseConfig {
  uri: string;
  options: mongoose.ConnectOptions;
  retryAttempts: number;
  retryDelay: number;
}

// Database connection state
interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionAttempts: number;
  lastConnectionAttempt?: Date;
  lastError?: Error;
}

class DatabaseManager {
  private config: DatabaseConfig;
  private state: ConnectionState;
  private healthCheckInterval?: NodeJS.Timeout;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor() {
    this.config = this.getConfig();
    this.state = {
      isConnected: false,
      isConnecting: false,
      connectionAttempts: 0
    };
    
    this.setupEventListeners();
  }

  private getConfig(): DatabaseConfig {
    const environment = process.env.NODE_ENV || 'development';
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-api';
    
    // Production-grade connection options
    const options: mongoose.ConnectOptions = {
      // Connection pool settings
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '20'),
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '5'),
      
      // Timeout settings (reduced for faster failure detection)
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT || '5000'),
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT || '10000'),
      connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000'),
      
      // Buffering settings
      bufferCommands: false,
      // bufferMaxEntries option is deprecated in newer mongoose versions
      
      // Write concern for production
      writeConcern: {
        w: environment === 'production' ? 'majority' : 1,
        j: true,
        wtimeout: 30000
      },
      
      // Read preference
      readPreference: 'primaryPreferred',
      
      // Compression
      compressors: ['zlib'],
      
      // Authentication
      authSource: process.env.DB_AUTH_SOURCE || 'admin',
      
      // SSL/TLS settings for production
      ...(environment === 'production' && {
        ssl: true,
        sslValidate: true
      })
    };

    return {
      uri,
      options,
      retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '5'),
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || '5000')
    };
  }

  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.connectionAttempts = 0;
      logger.info('✓ MongoDB connected successfully', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      });
      
      this.startHealthCheck();
    });

    mongoose.connection.on('error', (error: Error) => {
      this.state.lastError = error;
      logger.error('MongoDB connection error:', error);
      
      if (!this.state.isConnecting) {
        this.handleConnectionError();
      }
    });

    mongoose.connection.on('disconnected', () => {
      this.state.isConnected = false;
      logger.warn('MongoDB disconnected');
      
      this.stopHealthCheck();
      
      if (!this.state.isConnecting) {
        this.scheduleReconnect();
      }
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      this.state.isConnected = true;
      this.state.connectionAttempts = 0;
    });

    mongoose.connection.on('close', () => {
      logger.info('MongoDB connection closed');
      this.state.isConnected = false;
      this.stopHealthCheck();
    });
  }

  private async handleConnectionError(): Promise<void> {
    if (this.state.connectionAttempts < this.config.retryAttempts) {
      this.scheduleReconnect();
    } else {
      logger.error('Max connection attempts reached. Exiting...');
      process.exit(1);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = this.config.retryDelay * Math.pow(2, this.state.connectionAttempts);
    logger.info(`Scheduling reconnection attempt ${this.state.connectionAttempts + 1} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await mongoose.connection.db.admin().ping();
        logger.debug('Database health check passed');
      } catch (error) {
        logger.error('Database health check failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  public async connect(): Promise<void> {
    if (this.state.isConnected || this.state.isConnecting) {
      return;
    }

    this.state.isConnecting = true;
    this.state.connectionAttempts++;
    this.state.lastConnectionAttempt = new Date();

    try {
      logger.info(`Connecting to MongoDB (attempt ${this.state.connectionAttempts})...`);
      await mongoose.connect(this.config.uri, this.config.options);
    } catch (error) {
      this.state.isConnecting = false;
      this.state.lastError = error as Error;
      logger.error('MongoDB connection failed:', error);
      
      await this.handleConnectionError();
    }
  }

  public async disconnect(): Promise<void> {
    try {
      this.stopHealthCheck();
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      await mongoose.disconnect();
      this.state.isConnected = false;
      this.state.isConnecting = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  public getConnectionState(): ConnectionState {
    return { ...this.state };
  }

  public async getConnectionStats(): Promise<any> {
    if (!this.state.isConnected) {
      return null;
    }

    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      const serverStatus = await db.admin().serverStatus();
      
      return {
        database: {
          name: mongoose.connection.name,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          readyState: mongoose.connection.readyState
        },
        stats: {
          collections: stats.collections,
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          indexes: stats.indexes,
          indexSize: stats.indexSize
        },
        connections: {
          current: serverStatus.connections?.current || 0,
          available: serverStatus.connections?.available || 0,
          totalCreated: serverStatus.connections?.totalCreated || 0
        },
        uptime: serverStatus.uptime
      };
    } catch (error) {
      logger.error('Error getting connection stats:', error);
      return null;
    }
  }

  public isHealthy(): boolean {
    return this.state.isConnected && mongoose.connection.readyState === 1;
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

/**
 * Connect to MongoDB database with retry logic and monitoring
 */
export const connectDatabase = async (): Promise<void> => {
  await databaseManager.connect();
};

/**
 * Disconnect from MongoDB database
 */
export const disconnectDatabase = async (): Promise<void> => {
  await databaseManager.disconnect();
};

/**
 * Get database connection state
 */
export const getConnectionState = (): ConnectionState => {
  return databaseManager.getConnectionState();
};

/**
 * Get database connection statistics
 */
export const getConnectionStats = async (): Promise<any> => {
  return await databaseManager.getConnectionStats();
};

/**
 * Check if database is healthy
 */
export const isDatabaseHealthy = (): boolean => {
  return databaseManager.isHealthy();
};

// Handle connection events
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (error) => {
  logger.error('Mongoose connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
});

// Handle app termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('Mongoose connection closed through app termination');
  process.exit(0);
});
