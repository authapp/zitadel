/**
 * SCIM Group Resource Handlers
 * RFC 7644 Section 3.2 - Group Operations
 */

import { Request, Response, NextFunction } from 'express';
import { SCIM_SCHEMAS } from '../types';
import { SCIMErrors } from '../middleware/scim-error-handler';
import { zitadelGroupToSCIM, zitadelGroupsToSCIMList } from '../converters/zitadel-to-scim';
import { scimGroupToZitadelCreate, scimGroupToZitadelUpdate } from '../converters/scim-to-zitadel';
import { mapZitadelErrorToSCIM } from '../utils/error-mapper';

/**
 * GET /scim/v2/Groups
 * List groups with filtering and pagination
 */
async function listGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      filter: _filter,  // Reserved for future filtering implementation
      startIndex = '1',
      count = '100',
    } = req.query;

    // Parse pagination
    const start = Math.max(1, parseInt(startIndex as string) || 1);
    const limit = Math.min(200, parseInt(count as string) || 100);
    const offset = start - 1;

    // Get SCIM context
    const { queries, instanceID } = (req as any).scimContext;

    // Query organizations (groups are mapped to organizations)
    let result;
    try {
      result = await queries.org.searchOrgs({
        offset,
        limit,
        filter: {},
        instanceID
      });
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }
    
    const groups = result.orgs;
    const totalResults = result.total;

    // Convert to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = zitadelGroupsToSCIMList(groups, totalResults, start, limit, baseUrl);

    res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /scim/v2/Groups
 * Create a new group
 */
async function createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const scimGroup = req.body;

    // Validate required fields
    if (!scimGroup.displayName) {
      throw SCIMErrors.invalidValue('displayName is required');
    }

    // Validate schemas
    if (!scimGroup.schemas || !scimGroup.schemas.includes(SCIM_SCHEMAS.CORE_GROUP)) {
      throw SCIMErrors.invalidValue('Invalid or missing schemas');
    }

    // Convert to Zitadel format
    const zitadelGroup = scimGroupToZitadelCreate(scimGroup);

    // Get SCIM context
    const { commands, queries, instanceID, createContext } = (req as any).scimContext;
    const ctx = createContext();

    // Execute addOrg command (SCIM groups map to Zitadel organizations)
    let result;
    try {
      result = await commands.addOrg(ctx, {
        name: zitadelGroup.name
      });
    } catch (cmdError: any) {
      throw mapZitadelErrorToSCIM(cmdError);
    }

    // Process members if provided
    if (scimGroup.members && scimGroup.members.length > 0) {
      for (const member of scimGroup.members) {
        if (member.value) {
          try {
            await commands.addOrgMember(ctx, result.orgID, {
              userID: member.value,
              roles: ['ORG_MEMBER']
            });
          } catch (memberError) {
            console.log(`Warning: Could not add member ${member.value}:`, memberError);
            // Continue with other members
          }
        }
      }
    }

    // Wait for projection processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query back created organization
    const createdOrg = await queries.org.getOrgByID(result.orgID, instanceID);
    
    if (!createdOrg) {
      throw SCIMErrors.invalidValue('Group created but not found in query');
    }

    // Convert back to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse = zitadelGroupToSCIM(createdOrg, baseUrl);

    res.status(201)
      .location(`${baseUrl}/scim/v2/Groups/${result.orgID}`)
      .json(scimResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /scim/v2/Groups/:id
 * Get a single group by ID
 */
async function getGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Get SCIM context
    const { queries, instanceID } = (req as any).scimContext;

    // Query organization by ID
    let org;
    try {
      org = await queries.org.getOrgByID(id, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }

    if (!org) {
      throw SCIMErrors.notFound(`Group not found: ${id}`);
    }

    // Convert to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimGroup = zitadelGroupToSCIM(org, baseUrl);

    res.json(scimGroup);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /scim/v2/Groups/:id
 * Replace group (full update)
 */
async function replaceGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const scimGroup = req.body;

    // Validate required fields
    if (!scimGroup.displayName) {
      throw SCIMErrors.invalidValue('displayName is required');
    }

    // Get SCIM context
    const { commands, queries, instanceID, createContext } = (req as any).scimContext;
    const ctx = createContext();

    // Check if organization exists
    let existingOrg;
    try {
      existingOrg = await queries.org.getOrgByID(id, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }

    if (!existingOrg) {
      throw SCIMErrors.notFound(`Group not found: ${id}`);
    }

    // Convert to Zitadel format
    const updates = scimGroupToZitadelUpdate(scimGroup);

    // Only update if name changed
    if (updates.name && updates.name !== existingOrg.name) {
      try {
        await commands.changeOrg(ctx, id, {
          name: updates.name
        });
      } catch (cmdError: any) {
        throw mapZitadelErrorToSCIM(cmdError);
      }
    }

    // Wait for projection processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query the updated organization
    const updatedOrg = await queries.org.getOrgByID(id, instanceID);
    
    if (!updatedOrg) {
      throw SCIMErrors.invalidValue('Group updated but not found in query');
    }

    // Convert back to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse = zitadelGroupToSCIM(updatedOrg, baseUrl);

    res.json(scimResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /scim/v2/Groups/:id
 * Update group (partial update)
 */
async function patchGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const patchOp = req.body;

    // Validate schemas
    if (!patchOp.schemas || !patchOp.schemas.includes(SCIM_SCHEMAS.PATCH_OP)) {
      throw SCIMErrors.invalidValue('Invalid or missing schemas for PATCH operation');
    }

    // Validate operations
    if (!patchOp.Operations || !Array.isArray(patchOp.Operations) || patchOp.Operations.length === 0) {
      throw SCIMErrors.invalidValue('Operations array is required and must not be empty');
    }

    // Get SCIM context
    const { commands, queries, instanceID, createContext } = (req as any).scimContext;
    const ctx = createContext();

    // Check if organization exists
    let existingOrg;
    try {
      existingOrg = await queries.org.getOrgByID(id, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }

    if (!existingOrg) {
      throw SCIMErrors.notFound(`Group not found: ${id}`);
    }

    // Process PATCH operations
    let nameChanged = false;
    let newName = existingOrg.name;
    let membersToAdd: string[] = [];
    let membersToRemove: string[] = [];
    
    for (const operation of patchOp.Operations) {
      const { op, path, value } = operation;
      
      // Handle displayName operations
      if ((op === 'replace' || op === 'add') && path && path.toLowerCase() === 'displayname') {
        nameChanged = true;
        newName = value;
      }
      // Handle path-less replacement with displayName
      else if ((op === 'replace' || op === 'add') && !path && value && value.displayName) {
        nameChanged = true;
        newName = value.displayName;
      }
      // Handle member operations
      else if ((op === 'add') && path && path.toLowerCase() === 'members') {
        if (Array.isArray(value)) {
          membersToAdd = value.map((m: any) => m.value).filter(Boolean);
        }
      }
      else if ((op === 'remove') && path && path.toLowerCase() === 'members') {
        if (Array.isArray(value)) {
          membersToRemove = value.map((m: any) => m.value).filter(Boolean);
        }
      }
    }

    // Update name if changed
    if (nameChanged && newName !== existingOrg.name) {
      try {
        await commands.changeOrg(ctx, id, {
          name: newName
        });
      } catch (cmdError: any) {
        throw mapZitadelErrorToSCIM(cmdError);
      }
    }

    // Handle member additions
    for (const userID of membersToAdd) {
      try {
        await commands.addOrgMember(ctx, id, {
          userID,
          roles: ['ORG_MEMBER']
        });
      } catch (memberError) {
        console.log(`Warning: Could not add member ${userID}:`, memberError);
        // Continue with other members
      }
    }

    // Handle member removals
    for (const userID of membersToRemove) {
      try {
        await commands.removeOrgMember(ctx, id, userID);
      } catch (memberError) {
        console.log(`Warning: Could not remove member ${userID}:`, memberError);
        // Continue with other removals
      }
    }

    // Wait for projection processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query the updated organization
    const updatedOrg = await queries.org.getOrgByID(id, instanceID);
    
    if (!updatedOrg) {
      throw SCIMErrors.invalidValue('Group updated but not found in query');
    }

    // Convert back to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse = zitadelGroupToSCIM(updatedOrg, baseUrl);

    res.json(scimResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /scim/v2/Groups/:id
 * Delete a group
 */
async function deleteGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Get SCIM context
    const { commands, queries, instanceID, createContext } = (req as any).scimContext;
    const ctx = createContext();

    // Check if organization exists
    let existingOrg;
    try {
      existingOrg = await queries.org.getOrgByID(id, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }

    if (!existingOrg) {
      throw SCIMErrors.notFound(`Group not found: ${id}`);
    }

    // Execute removeOrg command
    try {
      await commands.removeOrg(ctx, id);
    } catch (cmdError: any) {
      throw mapZitadelErrorToSCIM(cmdError);
    }
    /*
    const { commands, createContext } = (req as any).scimContext;
    const ctx = createContext();
    
    await commands.removeOrganization(ctx, id);
    */

    // Return 204 No Content
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export const groupsHandler = {
  listGroups,
  createGroup,
  getGroup,
  replaceGroup,
  patchGroup,
  deleteGroup,
};
