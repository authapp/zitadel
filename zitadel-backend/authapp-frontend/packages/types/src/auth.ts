/**
 * Authentication and Authorization type definitions
 */

// User roles
export type UserRole =
  | 'SUPER_ADMIN'
  | 'ORG_OWNER'
  | 'ORG_ADMIN'
  | 'ORG_USER_MANAGER'
  | 'ORG_PROJECT_MANAGER'
  | 'PROJECT_OWNER'
  | 'PROJECT_ADMIN'
  | 'PROJECT_MEMBER'
  | 'USER';

// Permissions
export type Permission =
  | 'user.read'
  | 'user.write'
  | 'user.delete'
  | 'org.read'
  | 'org.write'
  | 'org.delete'
  | 'project.read'
  | 'project.write'
  | 'project.delete'
  | 'app.read'
  | 'app.write'
  | 'app.delete';

// Auth token
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: string;
  scope?: string[];
}

// Current user session
export interface UserSession {
  user: CurrentUser;
  token: AuthToken;
  expiresAt: string;
  isAuthenticated: boolean;
}

// Current authenticated user
export interface CurrentUser {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  roles: UserRole[];
  permissions: Permission[];
  organizationId?: string;
  organizationName?: string;
}

// Login credentials
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// OAuth/OIDC configuration
export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope: string[];
  responseType: 'code' | 'token' | 'id_token' | 'id_token token';
  grantType: 'authorization_code' | 'implicit' | 'password' | 'client_credentials' | 'refresh_token';
}

// SAML configuration
export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
  signRequests?: boolean;
  wantAssertionsSigned?: boolean;
}

// Multi-factor authentication
export interface MFAConfig {
  enabled: boolean;
  method: 'totp' | 'sms' | 'email' | 'u2f';
  verified: boolean;
}

// Password requirements
export interface PasswordPolicy {
  minLength: number;
  maxLength?: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialChars?: string;
  preventReuse?: number; // Number of previous passwords to prevent reuse
  expiryDays?: number; // Password expiry in days
}

// Session configuration
export interface SessionConfig {
  timeout: number; // in seconds
  maxAge: number; // in seconds
  slidingExpiration: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}
