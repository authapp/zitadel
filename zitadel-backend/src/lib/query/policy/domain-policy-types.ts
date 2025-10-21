/**
 * Domain Policy Types
 * Controls domain-related settings and user registration
 * Based on Zitadel Go internal/query/domain_policy.go
 */

/**
 * Domain policy configuration
 */
export interface DomainPolicy {
  id: string;
  instanceID: string;
  organizationID?: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  
  // Domain settings
  userLoginMustBeDomain: boolean;           // User login must include domain
  validateOrgDomains: boolean;              // Validate organization domains
  smtpSenderAddressMatchesInstanceDomain: boolean;  // SMTP sender must match instance domain
  
  // State
  isDefault: boolean;
  resourceOwner: string;
}

/**
 * Default domain policy settings
 */
export const DEFAULT_DOMAIN_POLICY: Partial<DomainPolicy> = {
  userLoginMustBeDomain: false,
  validateOrgDomains: false,
  smtpSenderAddressMatchesInstanceDomain: false,
};
