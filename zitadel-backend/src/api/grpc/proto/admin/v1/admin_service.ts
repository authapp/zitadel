/**
 * Admin Service Proto Types (v1)
 *
 * TypeScript equivalents for gRPC admin service types
 * Based on: proto/zitadel/admin.proto
 */

import { Details as ObjectDetails } from '../../object/v2/object';

// ============================================================================
// System & Health Types
// ============================================================================

export interface HealthzRequest {}

export interface HealthzResponse {}

export interface GetSupportedLanguagesRequest {}

export interface GetSupportedLanguagesResponse {
  languages: string[];
}

export interface GetAllowedLanguagesRequest {}

export interface GetAllowedLanguagesResponse {
  languages: string[];
}

export interface SetDefaultLanguageRequest {
  language: string;
}

export interface SetDefaultLanguageResponse {
  details: ObjectDetails;
}

export interface GetDefaultLanguageRequest {}

export interface GetDefaultLanguageResponse {
  language: string;
}

// ============================================================================
// Organization Types
// ============================================================================

export interface ListOrgsRequest {
  query?: {
    offset?: number;
    limit?: number;
    asc?: boolean;
  };
  queries?: OrgQuery[];
}

export interface ListOrgsResponse {
  details: {
    totalResult: number;
    processedSequence: number;
    timestamp: Date;
  };
  result: Org[];
}

export interface Org {
  id: string;
  details: ObjectDetails;
  state: OrgState;
  name: string;
  primaryDomain: string;
}

export enum OrgState {
  ORG_STATE_UNSPECIFIED = 0,
  ORG_STATE_ACTIVE = 1,
  ORG_STATE_INACTIVE = 2,
  ORG_STATE_REMOVED = 3,
}

export interface OrgQuery {
  // Placeholder for org query filters
  nameQuery?: {
    name: string;
    method: TextQueryMethod;
  };
  domainQuery?: {
    domain: string;
    method: TextQueryMethod;
  };
}

export enum TextQueryMethod {
  TEXT_QUERY_METHOD_EQUALS = 0,
  TEXT_QUERY_METHOD_EQUALS_IGNORE_CASE = 1,
  TEXT_QUERY_METHOD_STARTS_WITH = 2,
  TEXT_QUERY_METHOD_STARTS_WITH_IGNORE_CASE = 3,
  TEXT_QUERY_METHOD_CONTAINS = 4,
  TEXT_QUERY_METHOD_CONTAINS_IGNORE_CASE = 5,
  TEXT_QUERY_METHOD_ENDS_WITH = 6,
  TEXT_QUERY_METHOD_ENDS_WITH_IGNORE_CASE = 7,
}

export interface GetOrgByIDRequest {
  id: string;
}

export interface GetOrgByIDResponse {
  org: Org;
}

export interface IsOrgUniqueRequest {
  name: string;
  domain?: string;
}

export interface IsOrgUniqueResponse {
  isUnique: boolean;
}

export interface SetDefaultOrgRequest {
  orgId: string;
}

export interface SetDefaultOrgResponse {
  details: ObjectDetails;
}

export interface GetDefaultOrgRequest {}

export interface GetDefaultOrgResponse {
  org: Org;
}

// ============================================================================
// Secret Generator Types
// ============================================================================

export enum SecretGeneratorType {
  SECRET_GENERATOR_TYPE_UNSPECIFIED = 0,
  SECRET_GENERATOR_TYPE_INIT_CODE = 1,           // User initialization code
  SECRET_GENERATOR_TYPE_VERIFY_EMAIL_CODE = 2,   // Email verification code
  SECRET_GENERATOR_TYPE_VERIFY_PHONE_CODE = 3,   // Phone/SMS verification code
  SECRET_GENERATOR_TYPE_PASSWORD_RESET_CODE = 4, // Password reset code
  SECRET_GENERATOR_TYPE_PASSWORDLESS_INIT_CODE = 5, // Passwordless registration
  SECRET_GENERATOR_TYPE_APP_SECRET = 6,          // Application client secret
  SECRET_GENERATOR_TYPE_OTP_SMS = 7,             // OTP via SMS
  SECRET_GENERATOR_TYPE_OTP_EMAIL = 8,           // OTP via Email
}

export interface SecretGenerator {
  generatorType: SecretGeneratorType;
  details: ObjectDetails;
  length: number;
  expiry: string; // Duration (e.g., "10m", "1h")
  includeUpperCase: boolean;
  includeLowerCase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
}

export interface ListSecretGeneratorsRequest {}

export interface ListSecretGeneratorsResponse {
  details: {
    totalResult: number;
    processedSequence: number;
    timestamp: Date;
  };
  result: SecretGenerator[];
}

export interface GetSecretGeneratorRequest {
  generatorType: SecretGeneratorType;
}

export interface GetSecretGeneratorResponse {
  secretGenerator: SecretGenerator;
}

export interface UpdateSecretGeneratorRequest {
  generatorType: SecretGeneratorType;
  length?: number;
  expiry?: string;
  includeUpperCase?: boolean;
  includeLowerCase?: boolean;
  includeDigits?: boolean;
  includeSymbols?: boolean;
}

export interface UpdateSecretGeneratorResponse {
  details: ObjectDetails;
}

// ============================================================================
// SMTP Configuration Types (Deprecated - use Email Providers)
// ============================================================================

export interface GetSMTPConfigRequest {}

export interface GetSMTPConfigResponse {
  smtpConfig: SMTPConfig;
}

export interface SMTPConfig {
  details: ObjectDetails;
  senderAddress: string;
  senderName: string;
  tls: boolean;
  host: string;
  user: string;
  replyToAddress?: string;
  description?: string;
  state: SMTPConfigState;
}

export enum SMTPConfigState {
  SMTP_CONFIG_STATE_UNSPECIFIED = 0,
  SMTP_CONFIG_STATE_INACTIVE = 1,
  SMTP_CONFIG_STATE_ACTIVE = 2,
}

export interface UpdateSMTPConfigRequest {
  senderAddress?: string;
  senderName?: string;
  tls?: boolean;
  host?: string;
  user?: string;
  password?: string;
  replyToAddress?: string;
  description?: string;
}

export interface UpdateSMTPConfigResponse {
  details: ObjectDetails;
}

// ============================================================================
// Email Provider Types
// ============================================================================

export enum EmailProviderState {
  EMAIL_PROVIDER_STATE_UNSPECIFIED = 0,
  EMAIL_PROVIDER_STATE_INACTIVE = 1,
  EMAIL_PROVIDER_STATE_ACTIVE = 2,
}

export enum EmailProviderType {
  EMAIL_PROVIDER_TYPE_UNSPECIFIED = 0,
  EMAIL_PROVIDER_TYPE_SMTP = 1,
  EMAIL_PROVIDER_TYPE_HTTP = 2,
}

export interface EmailProvider {
  id: string;
  details: ObjectDetails;
  state: EmailProviderState;
  description: string;
  // SMTP config
  smtpConfig?: SMTPEmailConfig;
  // HTTP config
  httpConfig?: HTTPEmailConfig;
}

export interface SMTPEmailConfig {
  senderAddress: string;
  senderName: string;
  tls: boolean;
  host: string;
  user: string;
  replyToAddress?: string;
}

export interface HTTPEmailConfig {
  endpoint: string;
}

export interface ListEmailProvidersRequest {}

export interface ListEmailProvidersResponse {
  details: {
    totalResult: number;
    processedSequence: number;
    timestamp: Date;
  };
  result: EmailProvider[];
}

export interface GetEmailProviderRequest {}

export interface GetEmailProviderResponse {
  config: EmailProvider;
}

export interface GetEmailProviderByIdRequest {
  id: string;
}

export interface GetEmailProviderByIdResponse {
  config: EmailProvider;
}

export interface AddEmailProviderSMTPRequest {
  senderAddress: string;
  senderName?: string;
  tls?: boolean;
  host: string;
  user?: string;
  password?: string;
  replyToAddress?: string;
  description?: string;
}

export interface AddEmailProviderSMTPResponse {
  details: ObjectDetails;
  id: string;
}

export interface UpdateEmailProviderSMTPRequest {
  id: string;
  senderAddress?: string;
  senderName?: string;
  tls?: boolean;
  host?: string;
  user?: string;
  replyToAddress?: string;
  description?: string;
}

export interface UpdateEmailProviderSMTPResponse {
  details: ObjectDetails;
}

export interface AddEmailProviderHTTPRequest {
  endpoint: string;
  description?: string;
}

export interface AddEmailProviderHTTPResponse {
  details: ObjectDetails;
  id: string;
}

export interface UpdateEmailProviderHTTPRequest {
  id: string;
  endpoint?: string;
  description?: string;
}

export interface UpdateEmailProviderHTTPResponse {
  details: ObjectDetails;
}

export interface UpdateEmailProviderSMTPPasswordRequest {
  id: string;
  password: string;
}

export interface UpdateEmailProviderSMTPPasswordResponse {
  details: ObjectDetails;
}

export interface ActivateEmailProviderRequest {
  id: string;
}

export interface ActivateEmailProviderResponse {
  details: ObjectDetails;
}

export interface RemoveEmailProviderRequest {
  id: string;
}

export interface RemoveEmailProviderResponse {
  details: ObjectDetails;
}

// ============================================================================
// SMS Provider Types
// ============================================================================

export enum SMSProviderState {
  SMS_PROVIDER_STATE_UNSPECIFIED = 0,
  SMS_PROVIDER_STATE_INACTIVE = 1,
  SMS_PROVIDER_STATE_ACTIVE = 2,
}

export interface SMSProvider {
  id: string;
  details: ObjectDetails;
  state: SMSProviderState;
  description: string;
  twilioConfig?: TwilioSMSConfig;
}

export interface TwilioSMSConfig {
  sid: string;
  senderNumber: string;
  verifyServiceSid?: string;
}

export interface GetSMSProviderRequest {}

export interface GetSMSProviderResponse {
  config: SMSProvider;
}

export interface AddSMSProviderTwilioRequest {
  sid: string;
  token: string;
  senderNumber: string;
  verifyServiceSid?: string;
  description?: string;
}

export interface AddSMSProviderTwilioResponse {
  details: ObjectDetails;
  id: string;
}

export interface UpdateSMSProviderTwilioRequest {
  id: string;
  sid?: string;
  token?: string;
  senderNumber?: string;
  verifyServiceSid?: string;
  description?: string;
}

export interface UpdateSMSProviderTwilioResponse {
  details: ObjectDetails;
}

export interface ActivateSMSProviderRequest {
  id: string;
}

export interface ActivateSMSProviderResponse {
  details: ObjectDetails;
}

export interface RemoveSMSProviderRequest {
  id: string;
}

export interface RemoveSMSProviderResponse {
  details: ObjectDetails;
}

// ============================================================================
// Identity Provider (IDP) Types
// ============================================================================

export enum IDPType {
  UNSPECIFIED = 0,
  OIDC = 1,
  OAUTH = 2,
  LDAP = 3,
  SAML = 4,
  JWT = 5,
  AZURE = 6,
  GOOGLE = 7,
  APPLE = 8,
}

export enum IDPState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

export interface IDP {
  id: string;
  details: ObjectDetails;
  name: string;
  type: IDPType;
  state: IDPState;
  stylingType?: number;
  isCreationAllowed: boolean;
  isLinkingAllowed: boolean;
  isAutoCreation: boolean;
  isAutoUpdate: boolean;
  // Type-specific config stored as JSONB
  config?: any;
}

export interface ListIDPsRequest {
  query?: {
    offset?: number;
    limit?: number;
    name?: string;
    type?: IDPType;
  };
}

export interface ListIDPsResponse {
  idps: IDP[];
  totalResults: number;
}

export interface GetIDPRequest {
  id: string;
}

export interface GetIDPResponse {
  idp: IDP;
}

export interface AddOIDCIDPRequest {
  name: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
  scopes?: string[];
  displayNameMapping?: string;
  usernameMapping?: string;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
}

export interface AddOIDCIDPResponse {
  details: ObjectDetails;
  id: string;
}

export interface AddOAuthIDPRequest {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userEndpoint: string;
  scopes?: string[];
  idAttribute?: string;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
}

export interface AddOAuthIDPResponse {
  details: ObjectDetails;
  id: string;
}

export interface UpdateIDPRequest {
  id: string;
  name?: string;
  stylingType?: number;
}

export interface UpdateIDPResponse {
  details: ObjectDetails;
}

export interface RemoveIDPRequest {
  id: string;
}

export interface RemoveIDPResponse {
  details: ObjectDetails;
}

// ============================================================================
// Policy Types (Login & Branding)
// ============================================================================

// Login Policy
export interface LoginPolicy {
  details: ObjectDetails;
  allowUsernamePassword: boolean;
  allowRegister: boolean;
  allowExternalIdp: boolean;
  forceMfa: boolean;
  forceMfaLocalOnly: boolean;
  hidePasswordReset: boolean;
  ignoreUnknownUsernames: boolean;
  allowDomainDiscovery: boolean;
  disableLoginWithEmail: boolean;
  disableLoginWithPhone: boolean;
  defaultRedirectUri?: string;
  passwordCheckLifetime: number; // seconds
  externalLoginCheckLifetime: number; // seconds
  mfaInitSkipLifetime: number; // seconds
  secondFactorCheckLifetime: number; // seconds
  multiFactorCheckLifetime: number; // seconds
}

export interface GetDefaultLoginPolicyRequest {}

export interface GetDefaultLoginPolicyResponse {
  policy: LoginPolicy;
}

export interface UpdateDefaultLoginPolicyRequest {
  allowUsernamePassword?: boolean;
  allowRegister?: boolean;
  allowExternalIdp?: boolean;
  forceMfa?: boolean;
  forceMfaLocalOnly?: boolean;
  hidePasswordReset?: boolean;
  ignoreUnknownUsernames?: boolean;
  allowDomainDiscovery?: boolean;
  disableLoginWithEmail?: boolean;
  disableLoginWithPhone?: boolean;
  defaultRedirectUri?: string;
  passwordCheckLifetime?: number;
  externalLoginCheckLifetime?: number;
  mfaInitSkipLifetime?: number;
  secondFactorCheckLifetime?: number;
  multiFactorCheckLifetime?: number;
}

export interface UpdateDefaultLoginPolicyResponse {
  details: ObjectDetails;
}

// Label Policy (Branding)
export interface LabelPolicy {
  details: ObjectDetails;
  primaryColor: string;
  backgroundColor: string;
  warnColor: string;
  fontColor: string;
  primaryColorDark: string;
  backgroundColorDark: string;
  warnColorDark: string;
  fontColorDark: string;
  logoUrl?: string;
  iconUrl?: string;
  logoUrlDark?: string;
  iconUrlDark?: string;
  fontUrl?: string;
  hideLoginNameSuffix: boolean;
  errorMsgPopup: boolean;
  disableWatermark: boolean;
  themeMode: string; // 'auto' | 'light' | 'dark'
}

export interface GetLabelPolicyRequest {}

export interface GetLabelPolicyResponse {
  policy: LabelPolicy;
}

export interface UpdateLabelPolicyRequest {
  primaryColor?: string;
  backgroundColor?: string;
  warnColor?: string;
  fontColor?: string;
  primaryColorDark?: string;
  backgroundColorDark?: string;
  warnColorDark?: string;
  fontColorDark?: string;
  logoUrl?: string;
  iconUrl?: string;
  logoUrlDark?: string;
  iconUrlDark?: string;
  fontUrl?: string;
  hideLoginNameSuffix?: boolean;
  errorMsgPopup?: boolean;
  disableWatermark?: boolean;
  themeMode?: string;
}

export interface UpdateLabelPolicyResponse {
  details: ObjectDetails;
}

// Privacy Policy
export interface PrivacyPolicy {
  details: ObjectDetails;
  tosLink?: string;
  privacyLink?: string;
  helpLink?: string;
  supportEmail?: string;
  docsLink?: string;
  customLink?: string;
  customLinkText?: string;
}

export interface GetPrivacyPolicyRequest {}

export interface GetPrivacyPolicyResponse {
  policy: PrivacyPolicy;
}

export interface UpdatePrivacyPolicyRequest {
  tosLink?: string;
  privacyLink?: string;
  helpLink?: string;
  supportEmail?: string;
  docsLink?: string;
  customLink?: string;
  customLinkText?: string;
}

export interface UpdatePrivacyPolicyResponse {
  details: ObjectDetails;
}

// Lockout Policy
export interface LockoutPolicy {
  details: ObjectDetails;
  maxPasswordAttempts: number;
  maxOtpAttempts: number;
  showLockOutFailures: boolean;
}

export interface GetLockoutPolicyRequest {}

export interface GetLockoutPolicyResponse {
  policy: LockoutPolicy;
}

export interface UpdateLockoutPolicyRequest {
  maxPasswordAttempts?: number;
  maxOtpAttempts?: number;
  showLockOutFailures?: boolean;
}

export interface UpdateLockoutPolicyResponse {
  details: ObjectDetails;
}
