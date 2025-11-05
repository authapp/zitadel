import { HttpClient, HttpClientConfig } from './lib/http-client';
import { UserService } from './services/user-service';
import { OrganizationService } from './services/organization-service';
import { ProjectService } from './services/project-service';
import { ApplicationService } from './services/application-service';

export interface ApiClientConfig extends HttpClientConfig {
  // Additional client-specific config
}

/**
 * Main API client for Zitadel backend
 * Provides access to all service endpoints
 */
export class ApiClient {
  private httpClient: HttpClient;

  // Services
  public readonly users: UserService;
  public readonly organizations: OrganizationService;
  public readonly projects: ProjectService;
  public readonly applications: ApplicationService;

  constructor(config: ApiClientConfig) {
    this.httpClient = new HttpClient(config);

    // Initialize all services
    this.users = new UserService(this.httpClient);
    this.organizations = new OrganizationService(this.httpClient);
    this.projects = new ProjectService(this.httpClient);
    this.applications = new ApplicationService(this.httpClient);
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.httpClient.setAuthToken(token);
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.httpClient.clearAuthToken();
  }

  /**
   * Create a new API client instance
   */
  static create(config: ApiClientConfig): ApiClient {
    return new ApiClient(config);
  }
}

// Export default factory function
export function createApiClient(config: ApiClientConfig): ApiClient {
  return ApiClient.create(config);
}
