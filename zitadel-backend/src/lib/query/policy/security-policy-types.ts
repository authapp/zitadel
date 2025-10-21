/**
 * Security Policy Types
 * Defines security settings for the instance
 * Based on Zitadel Go internal/query/security_policy.go
 */

/**
 * Security Policy
 * Instance-level security settings (no org-level inheritance)
 */
export interface SecurityPolicy {
  aggregateID: string;
  instanceID: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  resourceOwner: string;
  
  // Security settings
  enableIframeEmbedding: boolean;
  allowedOrigins: string[];
  enableImpersonation: boolean;
}
