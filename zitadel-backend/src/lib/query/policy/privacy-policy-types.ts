/**
 * Privacy Policy Types
 * Defines privacy-related links and information
 * Based on Zitadel Go internal/query/privacy_policy.go
 */

/**
 * Privacy Policy
 * Contains links to TOS, privacy policy, help, support, and other resources
 */
export interface PrivacyPolicy {
  id: string;
  instanceID: string;
  organizationID?: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  resourceOwner: string;
  
  // Privacy links
  tosLink: string;
  privacyLink: string;
  helpLink: string;
  supportEmail: string;
  docsLink: string;
  customLink: string;
  customLinkText: string;
  
  isDefault: boolean;
}
