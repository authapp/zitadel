/**
 * User Write Model Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Event } from '../../../src/lib/eventstore/types';
import {
  UserWriteModel,
  UserState,
  UserType,
  isUserStateExists,
  isUserStateActive,
  isUserStateInactive,
  isUserStateLocked,
} from '../../../src/lib/command/user';

describe('UserWriteModel', () => {
  let wm: UserWriteModel;
  
  beforeEach(() => {
    wm = new UserWriteModel();
  });
  
  describe('reduce', () => {
    it('should handle user.human.added event', () => {
      const event: Event = {
        eventType: 'user.human.added',
        aggregateType: 'user',
        aggregateID: 'user-1',
        aggregateVersion: 1n,
        revision: 1,
        owner: 'org-1',
        instanceID: 'inst-1',
        creator: 'admin-1',
        createdAt: new Date(),
        payload: {
          username: 'john.doe',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
          preferredLanguage: 'en',
        },
        position: { position: 1, inTxOrder: 0 },
      };
      
      wm.reduce(event);
      
      expect(wm.userType).toBe(UserType.HUMAN);
      expect(wm.state).toBe(UserState.ACTIVE);
      expect(wm.username).toBe('john.doe');
      expect(wm.email).toBe('john@example.com');
      expect(wm.firstName).toBe('John');
      expect(wm.lastName).toBe('Doe');
      expect(wm.displayName).toBe('John Doe');
      expect(wm.preferredLanguage).toBe('en');
    });
    
    it('should handle user.machine.added event', () => {
      const event: Event = {
        eventType: 'user.machine.added',
        aggregateType: 'user',
        aggregateID: 'machine-1',
        aggregateVersion: 1n,
        revision: 1,
        owner: 'org-1',
        instanceID: 'inst-1',
        creator: 'admin-1',
        createdAt: new Date(),
        payload: {
          username: 'api-service',
          name: 'API Service',
        },
        position: { position: 1, inTxOrder: 0 },
      };
      
      wm.reduce(event);
      
      expect(wm.userType).toBe(UserType.MACHINE);
      expect(wm.state).toBe(UserState.ACTIVE);
      expect(wm.username).toBe('api-service');
      expect(wm.displayName).toBe('API Service');
    });
    
    it('should handle username change', () => {
      wm.username = 'old.username';
      
      const event: Event = {
        eventType: 'user.username.changed',
        aggregateType: 'user',
        aggregateID: 'user-1',
        aggregateVersion: 2n,
        revision: 1,
        owner: 'org-1',
        instanceID: 'inst-1',
        creator: 'user-1',
        createdAt: new Date(),
        payload: {
          username: 'new.username',
        },
        position: { position: 2, inTxOrder: 0 },
      };
      
      wm.reduce(event);
      
      expect(wm.username).toBe('new.username');
    });
    
    it('should handle email change and reset verification', () => {
      wm.email = 'old@example.com';
      wm.emailVerified = true;
      
      const event: Event = {
        eventType: 'user.email.changed',
        aggregateType: 'user',
        aggregateID: 'user-1',
        aggregateVersion: 2n,
        revision: 1,
        owner: 'org-1',
        instanceID: 'inst-1',
        creator: 'user-1',
        createdAt: new Date(),
        payload: {
          email: 'new@example.com',
        },
        position: { position: 2, inTxOrder: 0 },
      };
      
      wm.reduce(event);
      
      expect(wm.email).toBe('new@example.com');
      expect(wm.emailVerified).toBe(false);
    });
    
    it('should handle email verification', () => {
      wm.email = 'test@example.com';
      wm.emailVerified = false;
      
      const event: Event = {
        eventType: 'user.email.verified',
        aggregateType: 'user',
        aggregateID: 'user-1',
        aggregateVersion: 2n,
        revision: 1,
        owner: 'org-1',
        instanceID: 'inst-1',
        creator: 'user-1',
        createdAt: new Date(),
        payload: {},
        position: { position: 2, inTxOrder: 0 },
      };
      
      wm.reduce(event);
      
      expect(wm.emailVerified).toBe(true);
    });
    
    it('should handle user deactivation', () => {
      wm.state = UserState.ACTIVE;
      
      const event: Event = {
        eventType: 'user.deactivated',
        aggregateType: 'user',
        aggregateID: 'user-1',
        aggregateVersion: 2n,
        revision: 1,
        owner: 'org-1',
        instanceID: 'inst-1',
        creator: 'admin-1',
        createdAt: new Date(),
        payload: {},
        position: { position: 2, inTxOrder: 0 },
      };
      
      wm.reduce(event);
      
      expect(wm.state).toBe(UserState.INACTIVE);
    });
    
    it('should handle user locking', () => {
      wm.state = UserState.ACTIVE;
      
      const event: Event = {
        eventType: 'user.locked',
        aggregateType: 'user',
        aggregateID: 'user-1',
        aggregateVersion: 2n,
        revision: 1,
        owner: 'org-1',
        instanceID: 'inst-1',
        creator: 'admin-1',
        createdAt: new Date(),
        payload: {},
        position: { position: 2, inTxOrder: 0 },
      };
      
      wm.reduce(event);
      
      expect(wm.state).toBe(UserState.LOCKED);
    });
  });
  
  describe('state helper functions', () => {
    it('should check if user exists', () => {
      expect(isUserStateExists(UserState.UNSPECIFIED)).toBe(false);
      expect(isUserStateExists(UserState.DELETED)).toBe(false);
      expect(isUserStateExists(UserState.ACTIVE)).toBe(true);
      expect(isUserStateExists(UserState.INACTIVE)).toBe(true);
    });
    
    it('should check if user is active', () => {
      expect(isUserStateActive(UserState.ACTIVE)).toBe(true);
      expect(isUserStateActive(UserState.INACTIVE)).toBe(false);
    });
    
    it('should check if user is inactive', () => {
      expect(isUserStateInactive(UserState.INACTIVE)).toBe(true);
      expect(isUserStateInactive(UserState.ACTIVE)).toBe(false);
    });
    
    it('should check if user is locked', () => {
      expect(isUserStateLocked(UserState.LOCKED)).toBe(true);
      expect(isUserStateLocked(UserState.ACTIVE)).toBe(false);
    });
  });
});
