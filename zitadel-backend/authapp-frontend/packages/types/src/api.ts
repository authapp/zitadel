/**
 * API-related type definitions
 */

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// API Response wrapper
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// API Error
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  status?: number;
  timestamp?: string;
}

// API Request configuration
export interface ApiRequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  withCredentials?: boolean;
}

// Query parameters
export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null;
}

// List query parameters
export interface ListQueryParams {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  query?: string;
}

// API Client configuration
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  onRequest?: (config: ApiRequestConfig) => ApiRequestConfig;
  onResponse?: (response: ApiResponse) => ApiResponse;
  onError?: (error: ApiError) => void;
}

// Webhook payload
export interface WebhookPayload<T = any> {
  id: string;
  event: string;
  timestamp: string;
  data: T;
  signature?: string;
}

// API versioning
export type ApiVersion = 'v1' | 'v2' | 'v3' | 'v3alpha';

// Request retry configuration
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: ApiError) => boolean;
}
