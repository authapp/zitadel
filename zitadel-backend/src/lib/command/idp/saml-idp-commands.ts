/**
 * SAML IDP Commands
 * 
 * SAML 2.0 Identity Provider configuration
 * Based on Go: internal/command/org_idp_saml.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { IDPType, IDPState } from '../../query/idp/idp-types';

/**
 * SAML IDP Write Model
 * Tracks SAML IDP state for an organization
 */
class SAMLIDPWriteModel extends WriteModel {
  idpID: string;
  name: string = '';
  type: IDPType = IDPType.UNSPECIFIED;
  state: IDPState = IDPState.UNSPECIFIED;
  metadata?: Buffer;
  metadataURL?: string;
  binding: string = '';
  withSignedRequest: boolean = false;

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
      case 'org.idp.saml.added':
        this.state = IDPState.ACTIVE;
        this.name = event.payload?.name || '';
        this.type = IDPType.SAML;
        if (event.payload?.config) {
          this.metadata = event.payload.config.metadata;
          this.metadataURL = event.payload.config.metadataURL;
          this.binding = event.payload.config.binding || '';
          this.withSignedRequest = event.payload.config.withSignedRequest || false;
        }
        break;

      case 'org.idp.saml.changed':
        if (event.payload?.name) {
          this.name = event.payload.name;
        }
        if (event.payload?.config) {
          if (event.payload.config.metadata !== undefined) {
            this.metadata = event.payload.config.metadata;
          }
          if (event.payload.config.metadataURL !== undefined) {
            this.metadataURL = event.payload.config.metadataURL;
          }
          if (event.payload.config.binding !== undefined) {
            this.binding = event.payload.config.binding;
          }
          if (event.payload.config.withSignedRequest !== undefined) {
            this.withSignedRequest = event.payload.config.withSignedRequest;
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
 * SAML IDP Configuration Data
 */
export interface SAMLIDPData extends OrgIDPData {
  metadata?: Buffer;                     // SAML metadata XML as Buffer
  metadataURL?: string;                  // URL to fetch SAML metadata
  binding?: string;                      // HTTP-POST or HTTP-Redirect
  withSignedRequest?: boolean;           // Whether to sign SAML requests
  nameIDFormat?: string;                 // SAML NameID format
  transientMappingAttributeName?: string; // Attribute for transient mapping
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
 * Validation: SAML IDP Data
 */
function validateSAMLIDP(data: SAMLIDPData): void {
  validateIDPName(data.name);
  
  // Must have either metadata or metadataURL
  if (!data.metadata && !data.metadataURL) {
    throwInvalidArgument('either metadata or metadataURL is required', 'IDP-saml01');
  }

  // If metadataURL is provided, validate it
  if (data.metadataURL) {
    try {
      new URL(data.metadataURL);
    } catch {
      throwInvalidArgument('metadataURL must be a valid URL', 'IDP-saml02');
    }
  }

  // Validate binding if provided
  if (data.binding && !['HTTP-POST', 'HTTP-Redirect'].includes(data.binding)) {
    throwInvalidArgument('binding must be HTTP-POST or HTTP-Redirect', 'IDP-saml03');
  }
}

/**
 * Parse SAML Metadata XML
 * Simplified version - in production, use samlify or xml2js for full parsing
 */
function parseSAMLMetadata(metadata: Buffer): { entityID?: string; valid: boolean } {
  try {
    const metadataStr = metadata.toString('utf-8');
    
    // Basic validation: check if it's XML and contains required SAML elements
    if (!metadataStr.includes('<?xml') && !metadataStr.includes('<EntityDescriptor')) {
      return { valid: false };
    }

    // Extract entityID (basic regex - in production use proper XML parser)
    const entityIDMatch = metadataStr.match(/entityID="([^"]+)"/);
    const entityID = entityIDMatch ? entityIDMatch[1] : undefined;

    return { entityID, valid: true };
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Add SAML IDP to Organization
 * Based on Go: AddOrgSAMLIDP (org_idp_saml.go)
 */
export async function addSAMLIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: SAMLIDPData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateSAMLIDP(data);

  // 2. Validate metadata if provided
  if (data.metadata) {
    const parsed = parseSAMLMetadata(data.metadata);
    if (!parsed.valid) {
      throwInvalidArgument('invalid SAML metadata XML', 'IDP-saml04');
    }
  }

  // 3. Generate ID if not provided
  if (!data.idpID) {
    data.idpID = await this.nextID();
  }

  // 4. Check if IDP already exists
  const idpWM = new SAMLIDPWriteModel(orgID, data.idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state === IDPState.ACTIVE) {
    throwAlreadyExists('SAML IDP already exists', 'IDP-saml05');
  }

  // 5. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'create', orgID);

  // 6. Create SAML config
  const samlConfig: any = {
    binding: data.binding || 'HTTP-POST',
    withSignedRequest: data.withSignedRequest || false,
  };

  if (data.metadata) {
    samlConfig.metadata = data.metadata;
  }

  if (data.metadataURL) {
    samlConfig.metadataURL = data.metadataURL;
  }

  if (data.nameIDFormat) {
    samlConfig.nameIDFormat = data.nameIDFormat;
  }

  if (data.transientMappingAttributeName) {
    samlConfig.transientMappingAttributeName = data.transientMappingAttributeName;
  }

  // 7. Create event
  const command: Command = {
    eventType: 'org.idp.saml.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: data.idpID,
      name: data.name,
      type: IDPType.SAML,
      stylingType: data.stylingType || 0,
      isCreationAllowed: data.isCreationAllowed !== false,
      isLinkingAllowed: data.isLinkingAllowed !== false,
      isAutoCreation: data.isAutoCreation || false,
      isAutoUpdate: data.isAutoUpdate || false,
      config: samlConfig,
    },
  };

  // 8. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Change SAML IDP Configuration
 * Based on Go: ChangeOrgSAMLIDP (org_idp_saml.go)
 */
export async function changeSAMLIDP(
  this: Commands,
  ctx: Context,
  orgID: string,
  idpID: string,
  data: Partial<SAMLIDPData>
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(idpID, 'idpID');

  if (data.name) {
    validateIDPName(data.name);
  }

  // Validate metadataURL if provided
  if (data.metadataURL) {
    try {
      new URL(data.metadataURL);
    } catch {
      throwInvalidArgument('metadataURL must be a valid URL', 'IDP-saml02');
    }
  }

  // Validate binding if provided
  if (data.binding && !['HTTP-POST', 'HTTP-Redirect'].includes(data.binding)) {
    throwInvalidArgument('binding must be HTTP-POST or HTTP-Redirect', 'IDP-saml03');
  }

  // Validate metadata if provided
  if (data.metadata) {
    const parsed = parseSAMLMetadata(data.metadata);
    if (!parsed.valid) {
      throwInvalidArgument('invalid SAML metadata XML', 'IDP-saml04');
    }
  }

  // 2. Load SAML IDP write model
  const idpWM = new SAMLIDPWriteModel(orgID, idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state !== IDPState.ACTIVE) {
    throwNotFound('SAML IDP not found', 'IDP-saml06');
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

  // Build config object with changed SAML-specific fields
  const configChanges: any = {};
  
  if (data.metadata !== undefined) {
    configChanges.metadata = data.metadata;
    hasChanges = true;
  }

  if (data.metadataURL !== undefined && data.metadataURL !== idpWM.metadataURL) {
    configChanges.metadataURL = data.metadataURL;
    hasChanges = true;
  }

  if (data.binding !== undefined && data.binding !== idpWM.binding) {
    configChanges.binding = data.binding;
    hasChanges = true;
  }

  if (data.withSignedRequest !== undefined && data.withSignedRequest !== idpWM.withSignedRequest) {
    configChanges.withSignedRequest = data.withSignedRequest;
    hasChanges = true;
  }

  if (data.nameIDFormat !== undefined) {
    configChanges.nameIDFormat = data.nameIDFormat;
    hasChanges = true;
  }

  if (data.transientMappingAttributeName !== undefined) {
    configChanges.transientMappingAttributeName = data.transientMappingAttributeName;
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
    eventType: 'org.idp.saml.changed',
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
