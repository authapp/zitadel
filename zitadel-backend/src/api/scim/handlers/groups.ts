/**
 * SCIM Group Resource Handlers
 * RFC 7644 Section 3.2 - Group Operations
 */

import { Request, Response, NextFunction } from 'express';
import { SCIM_SCHEMAS } from '../types';
import { SCIMErrors } from '../middleware/scim-error-handler';
import { zitadelGroupToSCIM, zitadelGroupsToSCIMList } from '../converters/zitadel-to-scim';
import { scimGroupToZitadelCreate, scimGroupToZitadelUpdate } from '../converters/scim-to-zitadel';

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

    // TODO: Implement filtering and database query
    // For now, return stub data
    const groups: any[] = [];
    const totalResults = 0;

    /*
    // Example implementation:
    const { pool } = (req as any).scimContext;
    const offset = start - 1;
    
    const query = `
      SELECT * FROM organizations
      WHERE instance_id = $1
      ORDER BY id ASC
      LIMIT $2 OFFSET $3
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM organizations WHERE instance_id = $1`;
    
    const groupsResult = await pool.query(query, ['instance-id', limit, offset]);
    const countResult = await pool.queryOne(countQuery, ['instance-id']);
    
    groups = groupsResult.rows;
    totalResults = parseInt(countResult.total);
    */

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

    // TODO: Call Zitadel group/org creation command
    // For now, create stub
    const createdGroup = {
      id: `group_${Date.now()}`,
      groupId: `group_${Date.now()}`,
      ...zitadelGroup,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    /*
    // Example implementation:
    const { commands, createContext } = (req as any).scimContext;
    const ctx = createContext();
    
    // Create as organization or project role depending on use case
    const result = await commands.addOrganization(ctx, {
      name: zitadelGroup.name,
    });
    
    createdGroup = await getGroupById(result.orgId);
    */

    // Convert back to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse = zitadelGroupToSCIM(createdGroup, baseUrl);

    res.status(201)
      .location(`${baseUrl}/scim/v2/Groups/${createdGroup.id}`)
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

    // TODO: Fetch group from database
    const group: any = null;

    /*
    // Example implementation:
    const { queries } = (req as any).scimContext;
    const group = await queries.getOrganizationByID(id, 'instance-id');
    */

    if (!group) {
      throw SCIMErrors.notFound(`Group not found: ${id}`);
    }

    // Convert to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimGroup = zitadelGroupToSCIM(group, baseUrl);

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

    // Check if group exists
    let existingGroup: any = null;

    /*
    const { queries } = (req as any).scimContext;
    existingGroup = await queries.getOrganizationByID(id, 'instance-id');
    */

    if (!existingGroup) {
      throw SCIMErrors.notFound(`Group not found: ${id}`);
    }

    // Convert to Zitadel format
    const updates = scimGroupToZitadelUpdate(scimGroup);

    // TODO: Call Zitadel group update command
    const updatedGroup = {
      ...existingGroup,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    /*
    const { commands, createContext } = (req as any).scimContext;
    const ctx = createContext();
    
    await commands.updateOrganization(ctx, id, updates);
    updatedGroup = await queries.getOrganizationByID(id, 'instance-id');
    */

    // Convert back to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse = zitadelGroupToSCIM(updatedGroup, baseUrl);

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

    // Check if group exists
    let existingGroup: any = null;

    /*
    const { queries } = (req as any).scimContext;
    existingGroup = await queries.getOrganizationByID(id, 'instance-id');
    */

    if (!existingGroup) {
      throw SCIMErrors.notFound(`Group not found: ${id}`);
    }

    // Process PATCH operations
    const updates: any = {};
    
    for (const operation of patchOp.Operations) {
      const { op, path, value } = operation;
      
      if (op === 'replace' || op === 'add') {
        if (path && path.toLowerCase() === 'displayname') {
          updates.name = value;
        } else if (path && path.toLowerCase().startsWith('members')) {
          updates.members = value;
        } else if (!path && value) {
          if (value.displayName) updates.name = value.displayName;
          if (value.members) updates.members = value.members;
        }
      }
    }

    // TODO: Call Zitadel group update command
    const updatedGroup = {
      ...existingGroup,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    /*
    const { commands, createContext } = (req as any).scimContext;
    const ctx = createContext();
    
    await commands.updateOrganization(ctx, id, updates);
    updatedGroup = await queries.getOrganizationByID(id, 'instance-id');
    */

    // Convert back to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse = zitadelGroupToSCIM(updatedGroup, baseUrl);

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

    // Check if group exists
    const existingGroup: any = null;

    /*
    const { queries } = (req as any).scimContext;
    const existingGroup = await queries.getOrganizationByID(id, 'instance-id');
    */

    if (!existingGroup) {
      throw SCIMErrors.notFound(`Group not found: ${id}`);
    }

    // TODO: Call Zitadel group deletion command
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
