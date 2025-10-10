/**
 * Entity Mappers
 * 
 * Maps between domain entities and DTOs/Command data
 */

import { Organization, OrgState, OrgDomain } from '../entities/organization';
import { HumanUser, MachineUser, UserState, UserType } from '../entities/user';
import { Project, ProjectState, ProjectRole } from '../entities/project';
import { Email, Phone, Profile, Address } from '../value-objects';
import { Gender, Language } from '../types';

/**
 * Organization Mappers
 */
export class OrganizationMapper {
  /**
   * Map organization to simple object
   */
  static toObject(org: Organization) {
    return {
      id: org.aggregateID,
      resourceOwner: org.resourceOwner,
      name: org.name,
      state: org.state,
      primaryDomain: org.primaryDomain,
      domains: org.domains.map(d => ({
        orgID: d.orgID,
        domain: d.domain,
        isPrimary: d.isPrimary,
        isVerified: d.isVerified,
        validationType: d.validationType,
        validationCode: d.validationCode,
      })),
      creationDate: org.creationDate,
      changeDate: org.changeDate,
      sequence: org.sequence?.toString(),
    };
  }

  /**
   * Create organization from data
   */
  static fromObject(data: any): Organization {
    const org = new Organization(
      data.id,
      data.resourceOwner,
      data.name,
      data.state as OrgState,
      data.primaryDomain,
      [],
      data.creationDate ? new Date(data.creationDate) : undefined,
      data.changeDate ? new Date(data.changeDate) : undefined,
      data.sequence ? BigInt(data.sequence) : undefined
    );

    if (data.domains) {
      org.domains = data.domains.map((d: any) => 
        new OrgDomain(d.orgID, d.domain, d.isPrimary, d.isVerified, d.validationType)
      );
    }

    return org;
  }
}

/**
 * User Mappers
 */
export class UserMapper {
  /**
   * Map human user to object
   */
  static humanToObject(user: HumanUser) {
    return {
      id: user.aggregateID,
      resourceOwner: user.resourceOwner,
      username: user.username,
      type: UserType.HUMAN,
      state: user.state,
      profile: {
        givenName: user.profile.givenName,
        familyName: user.profile.familyName,
        displayName: user.profile.displayName,
        nickName: user.profile.nickName,
        preferredLanguage: user.profile.preferredLanguage,
        gender: user.profile.gender,
      },
      email: {
        email: user.email.email,
        isVerified: user.email.isVerified,
      },
      phone: user.phone ? {
        phoneNumber: user.phone.phoneNumber,
        isVerified: user.phone.isVerified,
      } : undefined,
      address: user.address ? {
        country: user.address.country,
        locality: user.address.locality,
        postalCode: user.address.postalCode,
        region: user.address.region,
        streetAddress: user.address.streetAddress,
      } : undefined,
      hashedPassword: user.hashedPassword,
      passwordChangeRequired: user.passwordChangeRequired,
      creationDate: user.creationDate,
      changeDate: user.changeDate,
      sequence: user.sequence?.toString(),
    };
  }

  /**
   * Map machine user to object
   */
  static machineToObject(user: MachineUser) {
    return {
      id: user.aggregateID,
      resourceOwner: user.resourceOwner,
      username: user.username,
      type: UserType.MACHINE,
      state: user.state,
      name: user.name,
      description: user.description,
      accessTokenType: user.accessTokenType,
      creationDate: user.creationDate,
      changeDate: user.changeDate,
      sequence: user.sequence?.toString(),
    };
  }

  /**
   * Create human user from data
   */
  static humanFromObject(data: any): HumanUser {
    const profile = new Profile(
      data.profile.givenName,
      data.profile.familyName,
      data.profile.displayName,
      data.profile.nickName,
      data.profile.preferredLanguage as Language,
      data.profile.gender as Gender
    );

    const email = new Email(
      data.email.email,
      data.email.isVerified
    );

    let phone: Phone | undefined;
    if (data.phone) {
      phone = new Phone(
        data.phone.phoneNumber,
        data.phone.isVerified
      );
    }

    let address: Address | undefined;
    if (data.address) {
      address = new Address(
        data.address.country,
        data.address.locality,
        data.address.postalCode,
        data.address.region,
        data.address.streetAddress
      );
    }

    return new HumanUser(
      data.id,
      data.resourceOwner,
      data.username,
      data.state as UserState,
      profile,
      email,
      phone,
      address,
      data.hashedPassword,
      data.passwordChangeRequired,
      data.creationDate ? new Date(data.creationDate) : undefined,
      data.changeDate ? new Date(data.changeDate) : undefined,
      data.sequence ? BigInt(data.sequence) : undefined
    );
  }

  /**
   * Create machine user from data
   */
  static machineFromObject(data: any): MachineUser {
    return new MachineUser(
      data.id,
      data.resourceOwner,
      data.username,
      data.state as UserState,
      data.name,
      data.description,
      data.accessTokenType,
      data.creationDate ? new Date(data.creationDate) : undefined,
      data.changeDate ? new Date(data.changeDate) : undefined,
      data.sequence ? BigInt(data.sequence) : undefined
    );
  }
}

/**
 * Project Mappers
 */
export class ProjectMapper {
  /**
   * Map project to object
   */
  static toObject(project: Project) {
    return {
      id: project.aggregateID,
      resourceOwner: project.resourceOwner,
      name: project.name,
      state: project.state,
      projectRoleAssertion: project.projectRoleAssertion,
      projectRoleCheck: project.projectRoleCheck,
      hasProjectCheck: project.hasProjectCheck,
      privateLabelingSetting: project.privateLabelingSetting,
      roles: project.roles.map(r => ({
        projectID: r.projectID,
        key: r.key,
        displayName: r.displayName,
        group: r.group,
      })),
      grants: project.grants.map(g => ({
        grantID: g.grantID,
        projectID: g.projectID,
        grantedOrgID: g.grantedOrgID,
        roleKeys: g.roleKeys,
        state: g.state,
      })),
      creationDate: project.creationDate,
      changeDate: project.changeDate,
      sequence: project.sequence?.toString(),
    };
  }

  /**
   * Create project from data
   */
  static fromObject(data: any): Project {
    const project = new Project(
      data.id,
      data.resourceOwner,
      data.name,
      data.state as ProjectState,
      data.projectRoleAssertion,
      data.projectRoleCheck,
      data.hasProjectCheck,
      data.privateLabelingSetting,
      data.creationDate ? new Date(data.creationDate) : undefined,
      data.changeDate ? new Date(data.changeDate) : undefined,
      data.sequence ? BigInt(data.sequence) : undefined
    );

    if (data.roles) {
      project.roles = data.roles.map((r: any) =>
        new ProjectRole(
          r.projectID,
          r.key,
          r.displayName,
          r.group
        )
      );
    }

    return project;
  }
}
