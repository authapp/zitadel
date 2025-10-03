/**
 * Factory functions for creating command components
 */

import { Eventstore } from '../eventstore/types';
import { CommandBus, Repository } from './types';
import { InMemoryCommandBus } from './command-bus';
import { createRepository } from './repository';
import { UserAggregate, OrganizationAggregate, ProjectAggregate } from './aggregate';

/**
 * Create a command bus
 */
export function createCommandBus(eventstore: Eventstore): CommandBus {
  return new InMemoryCommandBus(eventstore);
}

/**
 * Create a user repository
 */
export function createUserRepository(eventstore: Eventstore): Repository<UserAggregate> {
  return createRepository(eventstore, (id: string) => new UserAggregate(id));
}

/**
 * Create an organization repository
 */
export function createOrganizationRepository(eventstore: Eventstore): Repository<OrganizationAggregate> {
  return createRepository(eventstore, (id: string) => new OrganizationAggregate(id));
}

/**
 * Create a project repository
 */
export function createProjectRepository(eventstore: Eventstore): Repository<ProjectAggregate> {
  return createRepository(eventstore, (id: string) => new ProjectAggregate(id));
}

/**
 * Create command components from existing eventstore
 */
export function createCommandComponents(eventstore: Eventstore): {
  commandBus: CommandBus;
  userRepository: Repository<UserAggregate>;
  organizationRepository: Repository<OrganizationAggregate>;
  projectRepository: Repository<ProjectAggregate>;
} {
  return {
    commandBus: createCommandBus(eventstore),
    userRepository: createUserRepository(eventstore),
    organizationRepository: createOrganizationRepository(eventstore),
    projectRepository: createProjectRepository(eventstore),
  };
}
