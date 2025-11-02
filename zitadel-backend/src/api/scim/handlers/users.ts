/**
 * SCIM User Resource Handlers
 * RFC 7644 Section 3.2 - Resource Endpoint Operations
 */

import { Request, Response, NextFunction } from 'express';
import { SCIM_SCHEMAS } from '../types';
import { SCIMErrors } from '../middleware/scim-error-handler';
import { zitadelUserToSCIM, zitadelUsersToSCIMList } from '../converters/zitadel-to-scim';
import { scimUserToZitadelCreate, scimUserToZitadelUpdate, scimPatchToZitadelUpdate } from '../converters/scim-to-zitadel';
import { parseSCIMFilter, validateSCIMFilter } from '../filters/scim-filter-parser';
import { mapZitadelErrorToSCIM } from '../utils/error-mapper';

// Note: parseSCIMSort reserved for future sorting implementation

/**
 * GET /scim/v2/Users
 * Search/list users with filtering and pagination
 */
async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      filter,
      sortBy,
      sortOrder,
      startIndex = '1',
      count = '100',
    } = req.query;

    // Validate filter if provided
    if (filter && typeof filter === 'string') {
      const validation = validateSCIMFilter(filter);
      if (!validation.valid) {
        throw SCIMErrors.invalidValue(validation.error);
      }
    }

    // Parse pagination
    const start = Math.max(1, parseInt(startIndex as string) || 1);
    const limit = Math.min(200, parseInt(count as string) || 100);
    const offset = start - 1;

    // Get SCIM context
    const { queries, instanceID } = (req as any).scimContext;

    // Build search options from SCIM filter
    const searchOptions: any = {
      offset,
      limit,
      filter: {},
    };

    // Query users using UserQueries with error mapping
    let result;
    try {

    // Parse SCIM filter to search options
    if (filter && typeof filter === 'string') {
      const parsedFilter = parseSCIMFilter(filter);
      if (parsedFilter) {
        // Map SCIM filter to UserQueries filter format
        // This is a simplified mapping - extend as needed
        if (parsedFilter.attributePath === 'username' && parsedFilter.operator === 'eq') {
          searchOptions.filter.username = parsedFilter.compareValue;
        } else if (parsedFilter.attributePath === 'emails.value' && parsedFilter.operator === 'eq') {
          searchOptions.filter.email = parsedFilter.compareValue;
        } else if (parsedFilter.compareValue) {
          // Use searchString for general search
          searchOptions.filter.searchString = parsedFilter.compareValue;
        }
      }
    }

    // Parse sorting
    if (sortBy && typeof sortBy === 'string') {
      const sortMapping: any = {
        'userName': 'USERNAME',
        'name.formatted': 'DISPLAY_NAME',
        'emails.value': 'EMAIL',
        'meta.created': 'CREATED_AT',
      };
      searchOptions.sortBy = sortMapping[sortBy] || 'CREATED_AT';
      searchOptions.sortOrder = (sortOrder as string)?.toUpperCase() === 'DESCENDING' ? 'DESC' : 'ASC';
    }

      result = await queries.user.searchUsers(searchOptions, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }
    
    const users = result.users;
    const totalResults = result.total;

    // Convert to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = zitadelUsersToSCIMList(users, totalResults, start, limit, baseUrl);

    res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /scim/v2/Users
 * Create a new user
 */
async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const scimUser = req.body;

    // Validate required fields
    if (!scimUser.userName) {
      throw SCIMErrors.invalidValue('userName is required');
    }

    // Validate schemas
    if (!scimUser.schemas || !scimUser.schemas.includes(SCIM_SCHEMAS.CORE_USER)) {
      throw SCIMErrors.invalidValue('Invalid or missing schemas');
    }

    // Convert to Zitadel format
    const zitadelUser = scimUserToZitadelCreate(scimUser);

    // Get SCIM context
    const { commands, createContext } = (req as any).scimContext;
    const ctx = createContext();
    
    // Execute add user command with error mapping
    let result;
    try {
      result = await commands.addHumanUser(ctx, {
        orgID: ctx.orgID, // From context (extracted from auth token)
        username: zitadelUser.username,
        email: zitadelUser.email,
        firstName: zitadelUser.firstName,
        lastName: zitadelUser.lastName,
        phone: zitadelUser.phone,
        preferredLanguage: zitadelUser.preferredLanguage,
        password: zitadelUser.password,
        emailVerified: false,
        phoneVerified: false,
      });
    } catch (cmdError: any) {
      // Map command errors to SCIM errors (validation, duplicates, etc.)
      throw mapZitadelErrorToSCIM(cmdError);
    }

    // Construct SCIM response from command result and input data
    // Note: We don't query back from projections here because in test environments,
    // projections need to be explicitly processed by tests. In production, we could
    // query back, but it's not necessary since we have all the data we need.
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse: any = {
      schemas: [SCIM_SCHEMAS.CORE_USER],
      id: result.userID,
      meta: {
        resourceType: 'User',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        location: `${baseUrl}/scim/v2/Users/${result.userID}`,
      },
      userName: zitadelUser.username,
      active: true,
    };

    // Add name if provided
    if (zitadelUser.firstName || zitadelUser.lastName) {
      scimResponse.name = {
        givenName: zitadelUser.firstName,
        familyName: zitadelUser.lastName,
        formatted: `${zitadelUser.firstName || ''} ${zitadelUser.lastName || ''}`.trim(),
      };
    }

    // Add email if provided
    if (zitadelUser.email) {
      scimResponse.emails = [{
        value: zitadelUser.email,
        primary: true,
        type: 'work',
      }];
    }

    // Add phone if provided
    if (zitadelUser.phone) {
      scimResponse.phoneNumbers = [{
        value: zitadelUser.phone,
        primary: true,
        type: 'work',
      }];
    }

    // Add preferred language if provided
    if (zitadelUser.preferredLanguage) {
      scimResponse.preferredLanguage = zitadelUser.preferredLanguage;
    }

    res.status(201)
      .location(`${baseUrl}/scim/v2/Users/${result.userID}`)
      .json(scimResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /scim/v2/Users/:id
 * Get a single user by ID
 */
async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      throw SCIMErrors.invalidValue('User ID is required');
    }

    // Get SCIM context
    const { queries, instanceID } = (req as any).scimContext;

    // Query user by ID with error mapping
    let user;
    try {
      user = await queries.user.getUserByID(id, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }

    if (!user) {
      throw SCIMErrors.notFound('User not found');
    }

    // Convert to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimUser = zitadelUserToSCIM(user, baseUrl);

    res.json(scimUser);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /scim/v2/Users/:id
 * Replace user (full update)
 */
async function replaceUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const scimUser = req.body;

    // Validate required fields
    if (!scimUser.userName) {
      throw SCIMErrors.invalidValue('userName is required');
    }

    // Validate schemas
    if (!scimUser.schemas || !scimUser.schemas.includes(SCIM_SCHEMAS.CORE_USER)) {
      throw SCIMErrors.invalidValue('Invalid or missing schemas');
    }

    // Get SCIM context
    const { commands, queries, instanceID, createContext } = (req as any).scimContext;
    const ctx = createContext();
    const orgID = ctx.orgID;

    // Check if user exists
    let existingUser;
    try {
      existingUser = await queries.user.getUserByID(id, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }

    if (!existingUser) {
      throw SCIMErrors.notFound(`User not found: ${id}`);
    }

    // Convert to Zitadel format
    const updates = scimUserToZitadelUpdate(scimUser);

    try {
      // 1. Update profile (firstName, lastName, displayName, preferredLanguage)
      const profileChanged = 
        (updates.firstName && updates.firstName !== existingUser.firstName) ||
        (updates.lastName && updates.lastName !== existingUser.lastName) ||
        (updates.displayName && updates.displayName !== existingUser.displayName) ||
        (updates.preferredLanguage && updates.preferredLanguage !== existingUser.preferredLanguage);
      
      if (profileChanged) {
        await commands.changeProfile(ctx, id, orgID, {
          firstName: updates.firstName || existingUser.firstName,
          lastName: updates.lastName || existingUser.lastName,
          displayName: updates.displayName,
          preferredLanguage: updates.preferredLanguage,
        });
      }

      // 2. Update email if changed
      if (updates.email && updates.email !== existingUser.email) {
        await commands.changeEmail(ctx, id, orgID, updates.email);
      }

      // 3. Update phone if changed
      if (updates.phone && updates.phone !== existingUser.phone) {
        // Note: changeUserPhone sends verification code
        // For SCIM, we assume verified (production would need verification flow)
        await commands.changeUserPhone(ctx, id, updates.phone);
      }

      // 4. Update username if changed
      if (updates.username && updates.username !== existingUser.username) {
        await commands.changeUsername(ctx, id, orgID, updates.username);
      }

      // 5. Handle active status
      if (updates.active !== undefined && updates.active !== (existingUser.state === 'active')) {
        if (updates.active) {
          await commands.reactivateUser(ctx, id, orgID);
        } else {
          await commands.deactivateUser(ctx, id, orgID);
        }
      }
    } catch (cmdError: any) {
      throw mapZitadelErrorToSCIM(cmdError);
    }

    // Wait for projections to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query updated user
    const updatedUser = await queries.user.getUserByID(id, instanceID);
    
    if (!updatedUser) {
      throw SCIMErrors.invalidValue('User updated but not found in projection');
    }

    // Convert back to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse = zitadelUserToSCIM(updatedUser, baseUrl);

    res.json(scimResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /scim/v2/Users/:id
 * Update user (partial update)
 */
async function patchUser(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const orgID = ctx.orgID;

    // Check if user exists
    let existingUser;
    try {
      existingUser = await queries.user.getUserByID(id, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }

    if (!existingUser) {
      throw SCIMErrors.notFound(`User not found: ${id}`);
    }

    // Convert PATCH operations to updates
    const updates = scimPatchToZitadelUpdate(patchOp);

    try {
      // Execute commands based on what fields changed (same logic as PUT)
      // 1. Update profile if changed
      const profileChanged = 
        (updates.firstName && updates.firstName !== existingUser.firstName) ||
        (updates.lastName && updates.lastName !== existingUser.lastName) ||
        (updates.displayName && updates.displayName !== existingUser.displayName) ||
        (updates.preferredLanguage && updates.preferredLanguage !== existingUser.preferredLanguage);
      
      if (profileChanged) {
        await commands.changeProfile(ctx, id, orgID, {
          firstName: updates.firstName || existingUser.firstName,
          lastName: updates.lastName || existingUser.lastName,
          displayName: updates.displayName,
          preferredLanguage: updates.preferredLanguage,
        });
      }

      // 2. Update email if changed
      if (updates.email && updates.email !== existingUser.email) {
        await commands.changeEmail(ctx, id, orgID, updates.email);
      }

      // 3. Update phone if changed
      if (updates.phone && updates.phone !== existingUser.phone) {
        await commands.changeUserPhone(ctx, id, updates.phone);
      }
      
      // 4. Remove phone if set to null
      if (updates.phone === null && existingUser.phone) {
        await commands.removeUserPhone(ctx, id, orgID);
      }

      // 5. Update username if changed
      if (updates.username && updates.username !== existingUser.username) {
        await commands.changeUsername(ctx, id, orgID, updates.username);
      }

      // 6. Handle active status
      if (updates.active !== undefined && updates.active !== (existingUser.state === 'active')) {
        if (updates.active) {
          await commands.reactivateUser(ctx, id, orgID);
        } else {
          await commands.deactivateUser(ctx, id, orgID);
        }
      }
    } catch (cmdError: any) {
      throw mapZitadelErrorToSCIM(cmdError);
    }

    // Wait for projections to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query updated user
    const updatedUser = await queries.user.getUserByID(id, instanceID);
    
    if (!updatedUser) {
      throw SCIMErrors.invalidValue('User updated but not found in projection');
    }

    // Convert back to SCIM format
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const scimResponse = zitadelUserToSCIM(updatedUser, baseUrl);

    res.json(scimResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /scim/v2/Users/:id
 * Delete a user (soft delete)
 */
async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Get SCIM context
    const { commands, queries, instanceID, createContext } = (req as any).scimContext;
    const ctx = createContext();
    const orgID = ctx.orgID;

    // Check if user exists
    let existingUser;
    try {
      existingUser = await queries.user.getUserByID(id, instanceID);
    } catch (queryError: any) {
      throw mapZitadelErrorToSCIM(queryError);
    }

    if (!existingUser) {
      throw SCIMErrors.notFound(`User not found: ${id}`);
    }

    // Execute soft delete command
    try {
      await commands.removeUser(ctx, id, orgID);
    } catch (cmdError: any) {
      throw mapZitadelErrorToSCIM(cmdError);
    }

    // Wait for projections to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return 204 No Content (SCIM spec for successful delete)
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export const usersHandler = {
  listUsers,
  createUser,
  getUser,
  replaceUser,
  patchUser,
  deleteUser,
};
