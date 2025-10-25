/**
 * LDAP IDP Commands
 * 
 * LDAP/Active Directory Identity Provider configuration
 * Based on Go: internal/command/org_idp_ldap.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { IDPType, IDPState } from '../../query/idp/idp-types';

/**
 * LDAP IDP Write Model
 * Tracks LDAP IDP state for an organization
 */
class LDAPIDPWriteModel extends WriteModel {
  idpID: string;
  name: string = '';
  type: IDPType = IDPType.UNSPECIFIED;
  state: IDPState = IDPState.UNSPECIFIED;
  host: string = '';
  port: number = 389;
  tls: boolean = false;
  baseDN: string = '';
  userObjectClass: string = '';
  userUniqueAttribute: string = '';
  admin?: string;

  constructor(orgID: string, idpID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
    this.idpID = idpID;
  }

  reduce(event: Event): void {
    // Filter events for this specific IDP
    const eventIdpID = event.payload?.idpID || event.payload?.id;
    if (eventIdpID && eventIdpID !== this.idpID) {
      return;
    }

    switch (event.eventType) {
      case 'org.idp.ldap.added':
        this.state = IDPState.ACTIVE;
        this.name = event.payload?.name || '';
        this.type = IDPType.LDAP;
        if (event.payload?.config) {
          this.host = event.payload.config.host || '';
          this.port = event.payload.config.port || 389;
          this.tls = event.payload.config.tls || false;
          this.baseDN = event.payload.config.baseDN || '';
          this.userObjectClass = event.payload.config.userObjectClass || '';
          this.userUniqueAttribute = event.payload.config.userUniqueAttribute || '';
          this.admin = event.payload.config.admin;
        }
        break;

      case 'org.idp.ldap.changed':
        if (event.payload?.name) {
          this.name = event.payload.name;
        }
        if (event.payload?.config) {
          if (event.payload.config.host !== undefined) {
            this.host = event.payload.config.host;
          }
          if (event.payload.config.port !== undefined) {
            this.port = event.payload.config.port;
          }
          if (event.payload.config.tls !== undefined) {
            this.tls = event.payload.config.tls;
          }
          if (event.payload.config.baseDN !== undefined) {
            this.baseDN = event.payload.config.baseDN;
          }
          if (event.payload.config.userObjectClass !== undefined) {
            this.userObjectClass = event.payload.config.userObjectClass;
          }
          if (event.payload.config.userUniqueAttribute !== undefined) {
            this.userUniqueAttribute = event.payload.config.userUniqueAttribute;
          }
          if (event.payload.config.admin !== undefined) {
            this.admin = event.payload.config.admin;
          }
        }
        break;

      case 'org.idp.removed':
        this.state = IDPState.REMOVED;
        break;

      case 'org.removed':
        this.state = IDPState.REMOVED;
        break;
    }
  }
}

/**
 * Generic IDP Data
 */
export interface OrgIDPData {
  idpID?: string;
  name: string;
  stylingType?: number;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
}

/**
 * LDAP IDP Configuration Data
 */
export interface LDAPIDPData extends OrgIDPData {
  host: string;                          // LDAP server hostname
  port?: number;                         // LDAP port (default: 389)
  tls?: boolean;                         // Use TLS/SSL
  baseDN: string;                        // Base DN for user search
  userObjectClass: string;               // User object class (e.g., "person", "inetOrgPerson")
  userUniqueAttribute: string;           // Unique user attribute (e.g., "uid", "sAMAccountName")
  admin?: string;                        // Admin/bind DN for authentication
  password?: string;                     // Admin password
  attributes?: {
    idAttribute?: string;
    firstNameAttribute?: string;
    lastNameAttribute?: string;
    displayNameAttribute?: string;
    nickNameAttribute?: string;
    preferredUsernameAttribute?: string;
    emailAttribute?: string;
    emailVerifiedAttribute?: string;
    phoneAttribute?: string;
    phoneVerifiedAttribute?: string;
    preferredLanguageAttribute?: string;
    avatarURLAttribute?: string;
    profileAttribute?: string;
  };
}

/**
 * Validation: IDP Name
 */
function validateIDPName(name: string): void {
  validateRequired(name, 'name');
  if (name.length < 1 || name.length > 200) {
    throwInvalidArgument('name must be between 1 and 200 characters', 'IDP-name01');
  }
}

/**
 * Validation: LDAP IDP Data
 */
function validateLDAPIDP(data: LDAPIDPData): void {
  validateIDPName(data.name);
  validateRequired(data.host, 'host');
  validateRequired(data.baseDN, 'baseDN');
  validateRequired(data.userObjectClass, 'userObjectClass');
  validateRequired(data.userUniqueAttribute, 'userUniqueAttribute');

  // Validate port range
  if (data.port !== undefined && (data.port < 1 || data.port > 65535)) {
    throwInvalidArgument('port must be between 1 and 65535', 'IDP-ldap01');
  }

  // Validate host format (basic check)
  if (data.host.trim().length === 0) {
    throwInvalidArgument('host cannot be empty', 'IDP-ldap02');
  }

  // Validate baseDN format (should contain at least one =)
  if (!data.baseDN.includes('=')) {
    throwInvalidArgument('baseDN must be a valid distinguished name (e.g., dc=example,dc=com)', 'IDP-ldap03');
  }
}

/**
 * Add LDAP IDP to Organization
 * Based on Go: AddOrgLDAPIDP (org_idp_ldap.go)
 */
export async function addLDAPIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: LDAPIDPData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateLDAPIDP(data);

  // 2. Generate ID if not provided
  if (!data.idpID) {
    data.idpID = await this.nextID();
  }

  // 3. Check if IDP already exists
  const idpWM = new LDAPIDPWriteModel(orgID, data.idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state === IDPState.ACTIVE) {
    throwAlreadyExists('LDAP IDP already exists', 'IDP-ldap04');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'create', orgID);

  // 5. Create LDAP config
  const ldapConfig: any = {
    host: data.host,
    port: data.port || 389,
    tls: data.tls || false,
    baseDN: data.baseDN,
    userObjectClass: data.userObjectClass,
    userUniqueAttribute: data.userUniqueAttribute,
  };

  if (data.admin) {
    ldapConfig.admin = data.admin;
  }

  if (data.password) {
    ldapConfig.password = data.password;
  }

  if (data.attributes) {
    ldapConfig.attributes = data.attributes;
  }

  // 6. Create event
  const command: Command = {
    eventType: 'org.idp.ldap.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: data.idpID,
      name: data.name,
      type: IDPType.LDAP,
      stylingType: data.stylingType || 0,
      isCreationAllowed: data.isCreationAllowed !== false,
      isLinkingAllowed: data.isLinkingAllowed !== false,
      isAutoCreation: data.isAutoCreation || false,
      isAutoUpdate: data.isAutoUpdate || false,
      config: ldapConfig,
    },
  };

  // 7. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Change LDAP IDP Configuration
 * Based on Go: ChangeOrgLDAPIDP (org_idp_ldap.go)
 */
export async function changeLDAPIDP(
  this: Commands,
  ctx: Context,
  orgID: string,
  idpID: string,
  data: Partial<LDAPIDPData>
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(idpID, 'idpID');

  if (data.name) {
    validateIDPName(data.name);
  }

  if (data.port !== undefined && (data.port < 1 || data.port > 65535)) {
    throwInvalidArgument('port must be between 1 and 65535', 'IDP-ldap01');
  }

  if (data.baseDN && !data.baseDN.includes('=')) {
    throwInvalidArgument('baseDN must be a valid distinguished name', 'IDP-ldap03');
  }

  // 2. Load LDAP IDP write model
  const idpWM = new LDAPIDPWriteModel(orgID, idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state !== IDPState.ACTIVE) {
    throwNotFound('LDAP IDP not found', 'IDP-ldap05');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'update', orgID);

  // 4. Build payload with only changed fields
  const payload: any = { idpID };
  let hasChanges = false;

  if (data.name && data.name !== idpWM.name) {
    payload.name = data.name;
    hasChanges = true;
  }

  if (data.stylingType !== undefined) {
    payload.stylingType = data.stylingType;
    hasChanges = true;
  }

  if (data.isCreationAllowed !== undefined) {
    payload.isCreationAllowed = data.isCreationAllowed;
    hasChanges = true;
  }

  if (data.isLinkingAllowed !== undefined) {
    payload.isLinkingAllowed = data.isLinkingAllowed;
    hasChanges = true;
  }

  if (data.isAutoCreation !== undefined) {
    payload.isAutoCreation = data.isAutoCreation;
    hasChanges = true;
  }

  if (data.isAutoUpdate !== undefined) {
    payload.isAutoUpdate = data.isAutoUpdate;
    hasChanges = true;
  }

  // Build config object with changed LDAP-specific fields
  const configChanges: any = {};

  if (data.host !== undefined && data.host !== idpWM.host) {
    configChanges.host = data.host;
    hasChanges = true;
  }

  if (data.port !== undefined && data.port !== idpWM.port) {
    configChanges.port = data.port;
    hasChanges = true;
  }

  if (data.tls !== undefined && data.tls !== idpWM.tls) {
    configChanges.tls = data.tls;
    hasChanges = true;
  }

  if (data.baseDN !== undefined && data.baseDN !== idpWM.baseDN) {
    configChanges.baseDN = data.baseDN;
    hasChanges = true;
  }

  if (data.userObjectClass !== undefined && data.userObjectClass !== idpWM.userObjectClass) {
    configChanges.userObjectClass = data.userObjectClass;
    hasChanges = true;
  }

  if (data.userUniqueAttribute !== undefined && data.userUniqueAttribute !== idpWM.userUniqueAttribute) {
    configChanges.userUniqueAttribute = data.userUniqueAttribute;
    hasChanges = true;
  }

  if (data.admin !== undefined) {
    configChanges.admin = data.admin;
    hasChanges = true;
  }

  if (data.password !== undefined) {
    configChanges.password = data.password;
    hasChanges = true;
  }

  if (data.attributes !== undefined) {
    configChanges.attributes = data.attributes;
    hasChanges = true;
  }

  if (Object.keys(configChanges).length > 0) {
    payload.config = configChanges;
  }

  // Skip if no changes (idempotent)
  if (!hasChanges) {
    return writeModelToObjectDetails(idpWM);
  }

  // 5. Create event
  const command: Command = {
    eventType: 'org.idp.ldap.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload,
  };

  // 6. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}
