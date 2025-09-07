import crypto from 'crypto';

/**
 * Generate a unique ID with prefix
 * @param prefix - Prefix for the ID
 * @returns Generated unique ID
 */
export const generateId = (prefix: string): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${randomStr}`;
};

/**
 * Generate a secure random token
 * @param length - Length of the token
 * @returns Generated token
 */
export const generateToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash a string using SHA-256
 * @param input - String to hash
 * @returns Hashed string
 */
export const hashString = (input: string): string => {
  return crypto.createHash('sha256').update(input).digest('hex');
};

/**
 * Validate phone number format
 * @param phoneNumber - Phone number to validate
 * @returns Boolean indicating if phone number is valid
 */
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
};

/**
 * Format phone number for WhatsApp (add country code if missing)
 * @param phoneNumber - Phone number to format
 * @param defaultCountryCode - Default country code if not provided
 * @returns Formatted phone number
 */
export const formatPhoneNumber = (phoneNumber: string, defaultCountryCode: string = '1'): string => {
  let formatted = phoneNumber.replace(/\D/g, ''); // Remove non-digits
  
  if (!formatted.startsWith('1') && defaultCountryCode) {
    formatted = defaultCountryCode + formatted;
  }
  
  return formatted + '@c.us'; // WhatsApp format
};

/**
 * Sleep/delay function
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Sanitize filename for safe storage
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

/**
 * Generate API key
 * @param prefix - Prefix for API key
 * @returns Generated API key
 */
export const generateApiKey = (prefix: string = 'wa'): string => {
  const timestamp = Date.now().toString(36);
  const random1 = crypto.randomBytes(16).toString('hex');
  const random2 = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${timestamp}_${random1}${random2}`;
};

/**
 * Validate email format
 * @param email - Email to validate
 * @returns Boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Parse WhatsApp contact ID
 * @param contactId - WhatsApp contact ID
 * @returns Parsed contact info
 */
export const parseWhatsAppContact = (contactId: string): { phoneNumber: string; isGroup: boolean } => {
  const isGroup = contactId.includes('@g.us');
  const phoneNumber = contactId.split('@')[0];
  
  return {
    phoneNumber,
    isGroup
  };
};

/**
 * Send webhook to specified URL
 * @param url - Webhook URL
 * @param payload - Data to send
 * @returns Response with status and responseTime
 */
export const sendWebhook = async (url: string, payload: any): Promise<{ status: number; responseTime: number }> => {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-API-Service/1.0'
      },
      body: JSON.stringify(payload)
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: response.status,
      responseTime
    };
  } catch (error) {
     const responseTime = Date.now() - startTime;
     throw new Error(`Webhook delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
   }
 };
