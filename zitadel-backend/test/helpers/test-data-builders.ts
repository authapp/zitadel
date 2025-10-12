/**
 * Test Data Builders
 * 
 * Fluent builders for creating test data with sensible defaults
 */

import { generateTestEmail, generateTestUsername } from './command-test-helpers';

/**
 * User data builder
 */
export class UserBuilder {
  private data: {
    userID?: string;
    orgID: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    password?: string;
    preferredLanguage?: string;
    gender?: number;
  };

  constructor() {
    const username = generateTestUsername();
    this.data = {
      orgID: 'org-123', // Default test org ID
      username,
      email: generateTestEmail(username),
      firstName: 'Test',
      lastName: 'User',
    };
  }

  withID(userID: string): this {
    this.data.userID = userID;
    return this;
  }

  withOrgID(orgID: string): this {
    this.data.orgID = orgID;
    return this;
  }

  withUsername(username: string): this {
    this.data.username = username;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withName(firstName: string, lastName: string): this {
    this.data.firstName = firstName;
    this.data.lastName = lastName;
    return this;
  }

  withPhone(phone: string): this {
    this.data.phone = phone;
    return this;
  }

  withPassword(password: string): this {
    this.data.password = password;
    return this;
  }

  withLanguage(language: string): this {
    this.data.preferredLanguage = language;
    return this;
  }

  withGender(gender: number): this {
    this.data.gender = gender;
    return this;
  }

  build() {
    return { ...this.data };
  }
}

/**
 * Organization data builder
 */
export class OrganizationBuilder {
  private data: {
    orgID?: string;
    name: string;
    domain?: string;
  };

  constructor() {
    this.data = {
      name: `Test Org ${Date.now()}`,
    };
  }

  withID(orgID: string): this {
    this.data.orgID = orgID;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withDomain(domain: string): this {
    this.data.domain = domain;
    return this;
  }

  build() {
    return { ...this.data };
  }
}

/**
 * Project data builder
 */
export class ProjectBuilder {
  private data: {
    projectID?: string;
    name: string;
    projectRoleAssertion?: boolean;
    projectRoleCheck?: boolean;
    hasProjectCheck?: boolean;
    privateLabelingSetting?: number;
  };

  constructor() {
    this.data = {
      name: `Test Project ${Date.now()}`,
    };
  }

  withID(projectID: string): this {
    this.data.projectID = projectID;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withRoleAssertion(enabled: boolean = true): this {
    this.data.projectRoleAssertion = enabled;
    return this;
  }

  withRoleCheck(enabled: boolean = true): this {
    this.data.projectRoleCheck = enabled;
    return this;
  }

  withProjectCheck(enabled: boolean = true): this {
    this.data.hasProjectCheck = enabled;
    return this;
  }

  build() {
    return { ...this.data };
  }
}

/**
 * OIDC Application data builder
 */
export class OIDCAppBuilder {
  private data: {
    appID?: string;
    projectID: string;
    orgID: string;
    name: string;
    oidcAppType: number;
    redirectURIs: string[];
    responseTypes?: string[];
    grantTypes?: string[];
    authMethodType?: number;
    postLogoutRedirectURIs?: string[];
    devMode?: boolean;
  };

  constructor(projectID: string, orgID: string) {
    this.data = {
      projectID,
      orgID,
      name: `Test OIDC App ${Date.now()}`,
      oidcAppType: 1, // WEB
      redirectURIs: ['http://localhost:3000/callback'],
    };
  }

  withID(appID: string): this {
    this.data.appID = appID;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  asWebApp(): this {
    this.data.oidcAppType = 1;
    return this;
  }

  asUserAgent(): this {
    this.data.oidcAppType = 2;
    return this;
  }

  asNativeApp(): this {
    this.data.oidcAppType = 3;
    return this;
  }

  withRedirectURIs(...uris: string[]): this {
    this.data.redirectURIs = uris;
    return this;
  }

  withPostLogoutRedirectURIs(...uris: string[]): this {
    this.data.postLogoutRedirectURIs = uris;
    return this;
  }

  withDevMode(enabled: boolean = true): this {
    this.data.devMode = enabled;
    return this;
  }

  withAuthMethod(method: number): this {
    this.data.authMethodType = method;
    return this;
  }

  build() {
    return { ...this.data };
  }
}

/**
 * API Application data builder
 */
export class APIAppBuilder {
  private data: {
    appID?: string;
    projectID: string;
    orgID: string;
    name: string;
    authMethodType: number;
  };

  constructor(projectID: string, orgID: string) {
    this.data = {
      projectID,
      orgID,
      name: `Test API App ${Date.now()}`,
      authMethodType: 1, // BASIC
    };
  }

  withID(appID: string): this {
    this.data.appID = appID;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withBasicAuth(): this {
    this.data.authMethodType = 1;
    return this;
  }

  withPrivateKeyJWT(): this {
    this.data.authMethodType = 2;
    return this;
  }

  build() {
    return { ...this.data };
  }
}

/**
 * Helper functions for common test scenarios
 */

/**
 * Create a complete test user with sensible defaults
 */
export function createTestUserData(overrides?: Partial<ReturnType<UserBuilder['build']>>) {
  const builder = new UserBuilder();
  const defaults = builder.build();
  return { ...defaults, ...overrides };
}

/**
 * Create a complete test organization
 */
export function createTestOrgData(overrides?: Partial<ReturnType<OrganizationBuilder['build']>>) {
  const builder = new OrganizationBuilder();
  const defaults = builder.build();
  return { ...defaults, ...overrides };
}

/**
 * Create a complete test project
 */
export function createTestProjectData(overrides?: Partial<ReturnType<ProjectBuilder['build']>>) {
  const builder = new ProjectBuilder();
  const defaults = builder.build();
  return { ...defaults, ...overrides };
}
