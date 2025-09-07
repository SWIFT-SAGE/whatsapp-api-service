export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface WebhookPayload {
  event: string;
  sessionId?: string;
  timestamp: string;
  data: any;
}

export interface MessageData {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact';
  body?: string;
  caption?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isGroup?: boolean;
  groupName?: string;
  isForwarded?: boolean;
  quotedMessageId?: string;
}

export interface SessionStatus {
  sessionId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'failed';
  phoneNumber?: string;
  deviceInfo?: {
    name: string;
    version: string;
    battery?: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remaining?: number;
  resetTime?: Date;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, any>;
}

export interface WebhookResponse {
  status: number;
  responseTime: number;
  success: boolean;
  error?: string;
}