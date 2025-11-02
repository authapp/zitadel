/**
 * SCIM Discovery Endpoints
 * RFC 7643 - Schemas, ServiceProviderConfig, ResourceTypes
 */

import { Request, Response, NextFunction } from 'express';
import { SCIM_SCHEMAS } from '../types';
import { getUserSchema, getGroupSchema } from '../schemas/user-schema';
import { SCIMErrors } from '../middleware/scim-error-handler';

/**
 * GET /scim/v2/Schemas
 * Returns all supported schemas
 */
async function getSchemas(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const schemas = [
      getUserSchema(),
      getGroupSchema(),
    ];

    res.json({
      schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
      totalResults: schemas.length,
      startIndex: 1,
      itemsPerPage: schemas.length,
      Resources: schemas,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /scim/v2/Schemas/:id
 * Returns a specific schema by ID
 */
async function getSchema(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    let schema;
    if (id === SCIM_SCHEMAS.CORE_USER) {
      schema = getUserSchema();
    } else if (id === SCIM_SCHEMAS.CORE_GROUP) {
      schema = getGroupSchema();
    } else {
      throw SCIMErrors.notFound(`Schema not found: ${id}`);
    }

    res.json(schema);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /scim/v2/ServiceProviderConfig
 * Returns server capabilities
 */
async function getServiceProviderConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({
      schemas: [SCIM_SCHEMAS.SERVICE_PROVIDER_CONFIG],
      documentationUri: 'https://zitadel.com/docs/api/scim',
      patch: {
        supported: true,
      },
      bulk: {
        supported: false,
        maxOperations: 0,
        maxPayloadSize: 0,
      },
      filter: {
        supported: true,
        maxResults: 200,
      },
      changePassword: {
        supported: true,
      },
      sort: {
        supported: false,
      },
      etag: {
        supported: false,
      },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication using OAuth 2.0 Bearer Token',
          specUri: 'https://www.rfc-editor.org/rfc/rfc6750',
          primary: true,
        },
      ],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /scim/v2/ResourceTypes
 * Returns all supported resource types
 */
async function getResourceTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resourceTypes = [
      {
        schemas: [SCIM_SCHEMAS.RESOURCE_TYPE],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: SCIM_SCHEMAS.CORE_USER,
        schemaExtensions: [
          {
            schema: SCIM_SCHEMAS.ENTERPRISE_USER,
            required: false,
          },
        ],
      },
      {
        schemas: [SCIM_SCHEMAS.RESOURCE_TYPE],
        id: 'Group',
        name: 'Group',
        endpoint: '/Groups',
        description: 'Group',
        schema: SCIM_SCHEMAS.CORE_GROUP,
      },
    ];

    res.json({
      schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
      totalResults: resourceTypes.length,
      startIndex: 1,
      itemsPerPage: resourceTypes.length,
      Resources: resourceTypes,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /scim/v2/ResourceTypes/:id
 * Returns a specific resource type
 */
async function getResourceType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    let resourceType;
    if (id === 'User') {
      resourceType = {
        schemas: [SCIM_SCHEMAS.RESOURCE_TYPE],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: SCIM_SCHEMAS.CORE_USER,
        schemaExtensions: [
          {
            schema: SCIM_SCHEMAS.ENTERPRISE_USER,
            required: false,
          },
        ],
      };
    } else if (id === 'Group') {
      resourceType = {
        schemas: [SCIM_SCHEMAS.RESOURCE_TYPE],
        id: 'Group',
        name: 'Group',
        endpoint: '/Groups',
        description: 'Group',
        schema: SCIM_SCHEMAS.CORE_GROUP,
      };
    } else {
      throw SCIMErrors.notFound(`Resource type not found: ${id}`);
    }

    res.json(resourceType);
  } catch (error) {
    next(error);
  }
}

export const discoveryHandler = {
  getSchemas,
  getSchema,
  getServiceProviderConfig,
  getResourceTypes,
  getResourceType,
};
