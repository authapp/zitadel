import { HttpClient } from '../lib/http-client';
import {
  AddHumanUserRequest,
  AddHumanUserResponse,
  GetUserByIdResponse,
  ListUsersRequest,
  ListUsersResponse,
  UpdateUserNameRequest,
} from '../types/user';
import { ObjectDetails } from '../types/common';

export class UserService {
  constructor(private client: HttpClient) {}

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<GetUserByIdResponse> {
    return this.client.post('/zitadel.user.v2.UserService/GetUserByID', {
      userId,
    });
  }

  /**
   * List users with optional filters
   */
  async listUsers(request: ListUsersRequest = {}): Promise<ListUsersResponse> {
    return this.client.post('/zitadel.user.v2.UserService/ListUsers', request);
  }

  /**
   * Add human user
   */
  async addHumanUser(request: AddHumanUserRequest): Promise<AddHumanUserResponse> {
    return this.client.post('/zitadel.user.v2.UserService/AddHumanUser', request);
  }

  /**
   * Update username
   */
  async updateUserName(request: UpdateUserNameRequest): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.user.v2.UserService/UpdateUserName', request);
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.user.v2.UserService/DeactivateUser', {
      userId,
    });
  }

  /**
   * Reactivate user
   */
  async reactivateUser(userId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.user.v2.UserService/ReactivateUser', {
      userId,
    });
  }

  /**
   * Lock user
   */
  async lockUser(userId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.user.v2.UserService/LockUser', {
      userId,
    });
  }

  /**
   * Unlock user
   */
  async unlockUser(userId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.user.v2.UserService/UnlockUser', {
      userId,
    });
  }

  /**
   * Remove user (soft delete)
   */
  async removeUser(userId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.user.v2.UserService/RemoveUser', {
      userId,
    });
  }
}
