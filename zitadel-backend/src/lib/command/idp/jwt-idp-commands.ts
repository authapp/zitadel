/**
 * JWT IDP Commands
 * 
 * JWT token-based Identity Provider configuration
 * Based on Go: internal/command/org_idp_jwt.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { IDPType, IDPState } from '../../query/idp/idp-types';

/**
 * JWT IDP Write Model
 * Tracks JWT IDP state for an organization
 */
class JWTIDPWriteModel extends WriteModel {
  idpID: string;
  name: string = '';
  type: IDPType = IDPType.UNSPECIFIED;
  state: IDPState = IDPState.UNSPECIFIED;
  issuer: string = '';
  jwtEndpoint: string = '';
  keysEndpoint: string = '';
  headerName: string = '';

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
      case 'org.idp.jwt.added':
        this.state = IDPState.ACTIVE;
        this.name = event.payload?.name || '';
        this.type = IDPType.JWT;
        if (event.payload?.config) {
          this.issuer = event.payload.config.issuer || '';
          this.jwtEndpoint = event.payload.config.jwtEndpoint || '';
          this.keysEndpoint = event.payload.config.keysEndpoint || '';
          this.headerName = event.payload.config.headerName || '';
        }
        break;

      case 'org.idp.jwt.changed':
        if (event.payload?.name) {
          this.name = event.payload.name;
        }
        if (event.payload?.config) {
          if (event.payload.config.issuer) {
            this.issuer = event.payload.config.issuer;
          }
          if (event.payload.config.jwtEndpoint) {
            this.jwtEndpoint = event.payload.config.jwtEndpoint;
          }
          if (event.payload.config.keysEndpoint) {
            this.keysEndpoint = event.payload.config.keysEndpoint;
          }
          if (event.payload.config.headerName) {
            this.headerName = event.payload.config.headerName;
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
 * JWT IDP Configuration Data
 */
export interface JWTIDPData extends OrgIDPData {
  issuer: string;          // JWT issuer URL
  jwtEndpoint: string;     // Endpoint to get JWT tokens
  keysEndpoint: string;    // JWKS endpoint for public key validation
  headerName: string;      // HTTP header containing JWT (e.g., "Authorization")
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
 * Validation: JWT IDP Data
 */
function validateJWTIDP(data: JWTIDPData): void {
  validateIDPName(data.name);
  validateRequired(data.issuer, 'issuer');
  validateRequired(data.jwtEndpoint, 'jwtEndpoint');
  validateRequired(data.keysEndpoint, 'keysEndpoint');
  validateRequired(data.headerName, 'headerName');

  // Validate URLs
  try {
    new URL(data.issuer);
  } catch {
    throwInvalidArgument('issuer must be a valid URL', 'IDP-jwt01');
  }

  try {
    new URL(data.jwtEndpoint);
  } catch {
    throwInvalidArgument('jwtEndpoint must be a valid URL', 'IDP-jwt02');
  }

  try {
    new URL(data.keysEndpoint);
  } catch {
    throwInvalidArgument('keysEndpoint must be a valid URL', 'IDP-jwt03');
  }

  // Validate header name is not empty
  if (data.headerName.trim().length === 0) {
    throwInvalidArgument('headerName cannot be empty', 'IDP-jwt04');
  }
}

/**
 * Add JWT IDP to Organization
 * Based on Go: AddOrgJWTIDP (org_idp_jwt.go)
 */
export async function addJWTIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: JWTIDPData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateJWTIDP(data);

  // 2. Generate ID if not provided
  if (!data.idpID) {
    data.idpID = await this.nextID();
  }

  // 3. Check if IDP already exists
  const idpWM = new JWTIDPWriteModel(orgID, data.idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state === IDPState.ACTIVE) {
    throwAlreadyExists('JWT IDP already exists', 'IDP-jwt05');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'create', orgID);

  // 5. Create JWT config
  const jwtConfig = {
    issuer: data.issuer,
    jwtEndpoint: data.jwtEndpoint,
    keysEndpoint: data.keysEndpoint,
    headerName: data.headerName,
  };

  // 6. Create event
  const command: Command = {
    eventType: 'org.idp.jwt.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: data.idpID,
      name: data.name,
      type: IDPType.JWT,
      stylingType: data.stylingType || 0,
      isCreationAllowed: data.isCreationAllowed !== false,
      isLinkingAllowed: data.isLinkingAllowed !== false,
      isAutoCreation: data.isAutoCreation || false,
      isAutoUpdate: data.isAutoUpdate || false,
      config: jwtConfig,
    },
  };

  // 7. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Change JWT IDP Configuration
 * Based on Go: ChangeOrgJWTIDP (org_idp_jwt.go)
 */
export async function changeJWTIDP(
  this: Commands,
  ctx: Context,
  orgID: string,
  idpID: string,
  data: Partial<JWTIDPData>
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(idpID, 'idpID');

  if (data.name) {
    validateIDPName(data.name);
  }

  // Validate URLs if provided
  if (data.issuer) {
    try {
      new URL(data.issuer);
    } catch {
      throwInvalidArgument('issuer must be a valid URL', 'IDP-jwt01');
    }
  }

  if (data.jwtEndpoint) {
    try {
      new URL(data.jwtEndpoint);
    } catch {
      throwInvalidArgument('jwtEndpoint must be a valid URL', 'IDP-jwt02');
    }
  }

  if (data.keysEndpoint) {
    try {
      new URL(data.keysEndpoint);
    } catch {
      throwInvalidArgument('keysEndpoint must be a valid URL', 'IDP-jwt03');
    }
  }

  if (data.headerName !== undefined && data.headerName.trim().length === 0) {
    throwInvalidArgument('headerName cannot be empty', 'IDP-jwt04');
  }

  // 2. Load JWT IDP write model
  const idpWM = new JWTIDPWriteModel(orgID, idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state !== IDPState.ACTIVE) {
    throwNotFound('JWT IDP not found', 'IDP-jwt06');
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

  // Build config object with changed JWT-specific fields
  const configChanges: any = {};
  
  if (data.issuer && data.issuer !== idpWM.issuer) {
    configChanges.issuer = data.issuer;
    hasChanges = true;
  }

  if (data.jwtEndpoint && data.jwtEndpoint !== idpWM.jwtEndpoint) {
    configChanges.jwtEndpoint = data.jwtEndpoint;
    hasChanges = true;
  }

  if (data.keysEndpoint && data.keysEndpoint !== idpWM.keysEndpoint) {
    configChanges.keysEndpoint = data.keysEndpoint;
    hasChanges = true;
  }

  if (data.headerName && data.headerName !== idpWM.headerName) {
    configChanges.headerName = data.headerName;
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
    eventType: 'org.idp.jwt.changed',
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
