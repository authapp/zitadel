/**
 * Organization Converters
 * 
 * Convert between proto types and domain/command types
 * Based on: internal/api/grpc/org/v2/org.go
 */

import { 
  AddOrganizationRequest,
  AddOrganizationRequest_Admin,
  AddOrganizationResponse,
} from '../../proto/org/v2/org_service';
import { Details } from '../../proto/object/v2/object';
import { OrgSetupData, OrgSetupAdmin } from '@/lib/command/org/org-setup-commands';
import { ObjectDetails } from '@/lib/command/write-model';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Convert AddOrganizationRequest to OrgSetupData command
 */
export function addOrganizationRequestToCommand(
  request: AddOrganizationRequest
): OrgSetupData {
  const admins = request.admins.map(admin => 
    addOrganizationRequestAdminToCommand(admin)
  );

  return {
    name: request.name,
    orgID: request.orgId,
    admins,
  };
}

/**
 * Convert admin request to command admin
 */
function addOrganizationRequestAdminToCommand(
  admin: AddOrganizationRequest_Admin
): OrgSetupAdmin {
  // Check if user ID is provided (existing user)
  if (admin.userType.userId) {
    return {
      userID: admin.userType.userId,
      roles: admin.roles || [],
    };
  }

  // Check if human user data is provided (new user)
  if (admin.userType.human) {
    const human = admin.userType.human;
    
    return {
      username: human.username,
      email: human.email?.email,
      firstName: human.profile?.givenName || '',
      lastName: human.profile?.familyName || '',
      password: human.password?.password,
      roles: admin.roles || [],
    };
  }

  // No valid user type provided
  return throwInvalidArgument('userType must be either userId or human', 'ORGv2-Conv01');
}

/**
 * Convert created org result to AddOrganizationResponse
 */
export function createdOrgToAddOrganizationResponse(
  createdOrg: ObjectDetails & { 
    orgID: string;
    createdAdmins: Array<{ userID: string; username: string }>;
  }
): AddOrganizationResponse {
  const createdAdmins = createdOrg.createdAdmins.map((admin: { userID: string; username: string }) => ({
    userId: admin.userID,
    // Email and phone codes would come from user creation
    // For now, we don't have these in the simplified implementation
    emailCode: undefined,
    phoneCode: undefined,
  }));

  return {
    details: objectDetailsToDetailsProto(createdOrg),
    organizationId: createdOrg.orgID,
    createdAdmins,
  };
}

/**
 * Convert ObjectDetails to proto Details
 */
export function objectDetailsToDetailsProto(
  details: ObjectDetails
): Details {
  return {
    sequence: Number(details.sequence),
    changeDate: details.eventDate,
    resourceOwner: details.resourceOwner,
  };
}

/**
 * Convert proto Details to ObjectDetails
 */
export function detailsProtoToObjectDetails(
  details: Details
): Partial<ObjectDetails> {
  return {
    sequence: BigInt(details.sequence),
    eventDate: details.changeDate,
    resourceOwner: details.resourceOwner,
  };
}
