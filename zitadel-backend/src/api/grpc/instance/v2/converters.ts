/**
 * Instance Service Converters
 * 
 * Converts between gRPC proto types and internal command/query types
 */

import { ObjectDetails } from '../../../../lib/command/write-model';
import { Details as DetailsProto } from '../../proto/object/v2/object';
import {
  SetupInstanceRequest,
  SetupInstanceResponse,
  InstanceFeatures,
  InstanceState as InstanceStateProto,
} from '../../proto/instance/v2/instance_service';
import { SetupInstanceData, FeatureConfig } from '../../../../lib/command/instance/instance-commands';
import { InstanceState as InstanceStateQuery } from '../../../../lib/query/instance/instance-types';

/**
 * Convert ObjectDetails to proto Details
 */
export function objectDetailsToDetailsProto(details: ObjectDetails): DetailsProto {
  return {
    sequence: Number(details.sequence) || 0,
    changeDate: details.eventDate || new Date(),
    resourceOwner: details.resourceOwner || '',
  };
}

/**
 * Convert query layer InstanceState to proto InstanceState
 */
export function instanceStateToProto(state: InstanceStateQuery): InstanceStateProto {
  switch (state) {
    case InstanceStateQuery.ACTIVE:
      return InstanceStateProto.STATE_RUNNING;
    case InstanceStateQuery.INACTIVE:
      return InstanceStateProto.STATE_STOPPED;
    case InstanceStateQuery.UNSPECIFIED:
    default:
      return InstanceStateProto.STATE_UNSPECIFIED;
  }
}

/**
 * Convert SetupInstanceRequest to command data
 */
export function setupInstanceRequestToCommand(request: SetupInstanceRequest): SetupInstanceData {
  return {
    instanceName: request.instanceName,
    defaultOrgName: request.defaultOrgName,
    adminUser: {
      username: request.adminUser.username,
      email: request.adminUser.email,
      firstName: request.adminUser.firstName,
      lastName: request.adminUser.lastName,
      password: request.adminUser.password,
    },
    customDomain: request.customDomain,
    defaultLanguage: request.defaultLanguage,
  };
}

/**
 * Convert setup result to response
 */
export function setupResultToResponse(result: {
  instanceID: string;
  orgID: string;
  userID: string;
} & ObjectDetails): SetupInstanceResponse {
  return {
    instanceId: result.instanceID,
    orgId: result.orgID,
    userId: result.userID,
    details: objectDetailsToDetailsProto(result),
  };
}

/**
 * Convert feature config to proto features
 */
export function featureConfigToProto(config: FeatureConfig): InstanceFeatures {
  return {
    loginDefaultOrg: config.loginDefaultOrg || false,
    triggerIntrospectionProjections: config.triggerIntrospectionProjections || false,
    legacyIntrospection: config.legacyIntrospection || false,
    userSchema: config.userSchema || false,
    tokenExchange: config.tokenExchange || false,
    actions: config.actions || false,
    improvedPerformance: config.improvedPerformance || false,
  };
}

/**
 * Convert proto features to feature config
 */
export function protoToFeatureConfig(request: {
  loginDefaultOrg?: boolean;
  triggerIntrospectionProjections?: boolean;
  legacyIntrospection?: boolean;
  userSchema?: boolean;
  tokenExchange?: boolean;
  actions?: boolean;
  improvedPerformance?: boolean;
}): FeatureConfig {
  const config: FeatureConfig = {};
  
  if (request.loginDefaultOrg !== undefined) {
    config.loginDefaultOrg = request.loginDefaultOrg;
  }
  if (request.triggerIntrospectionProjections !== undefined) {
    config.triggerIntrospectionProjections = request.triggerIntrospectionProjections;
  }
  if (request.legacyIntrospection !== undefined) {
    config.legacyIntrospection = request.legacyIntrospection;
  }
  if (request.userSchema !== undefined) {
    config.userSchema = request.userSchema;
  }
  if (request.tokenExchange !== undefined) {
    config.tokenExchange = request.tokenExchange;
  }
  if (request.actions !== undefined) {
    config.actions = request.actions;
  }
  if (request.improvedPerformance !== undefined) {
    config.improvedPerformance = request.improvedPerformance;
  }
  
  return config;
}
