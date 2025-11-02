/**
 * Convert SCIM User to Zitadel User format
 * Maps SCIM 2.0 User resource to internal Zitadel user commands
 */

import { SCIMUser, SCIMGroup, SCIMPatchOp } from '../types';

/**
 * Convert SCIM User to Zitadel user creation data
 */
export function scimUserToZitadelCreate(scimUser: SCIMUser) {
  const zitadelUser: any = {
    username: scimUser.userName,
  };

  // Name fields
  if (scimUser.name) {
    if (scimUser.name.givenName) {
      zitadelUser.firstName = scimUser.name.givenName;
    }
    if (scimUser.name.familyName) {
      zitadelUser.lastName = scimUser.name.familyName;
    }
  }

  // Display name
  if (scimUser.displayName) {
    zitadelUser.displayName = scimUser.displayName;
  } else if (scimUser.name?.formatted) {
    zitadelUser.displayName = scimUser.name.formatted;
  }

  // Nick name
  if (scimUser.nickName) {
    zitadelUser.nickName = scimUser.nickName;
  }

  // Preferred language
  if (scimUser.preferredLanguage) {
    zitadelUser.preferredLanguage = scimUser.preferredLanguage;
  }

  // Email (primary)
  if (scimUser.emails && scimUser.emails.length > 0) {
    const primaryEmail = scimUser.emails.find(e => e.primary) || scimUser.emails[0];
    zitadelUser.email = primaryEmail.value;
  }

  // Phone (primary)
  if (scimUser.phoneNumbers && scimUser.phoneNumbers.length > 0) {
    const primaryPhone = scimUser.phoneNumbers.find(p => p.primary) || scimUser.phoneNumbers[0];
    zitadelUser.phone = primaryPhone.value;
  }

  // Password
  if (scimUser.password) {
    zitadelUser.password = scimUser.password;
  }

  // Active status
  if (scimUser.active !== undefined) {
    zitadelUser.active = scimUser.active;
  }

  // External ID
  if (scimUser.externalId) {
    zitadelUser.externalId = scimUser.externalId;
  }

  return zitadelUser;
}

/**
 * Convert SCIM User to Zitadel user update data
 */
export function scimUserToZitadelUpdate(scimUser: SCIMUser) {
  const updates: any = {};

  // Username (if changed)
  if (scimUser.userName) {
    updates.username = scimUser.userName;
  }

  // Name fields
  if (scimUser.name) {
    if (scimUser.name.givenName !== undefined) {
      updates.firstName = scimUser.name.givenName;
    }
    if (scimUser.name.familyName !== undefined) {
      updates.lastName = scimUser.name.familyName;
    }
  }

  // Display name
  if (scimUser.displayName !== undefined) {
    updates.displayName = scimUser.displayName;
  }

  // Nick name
  if (scimUser.nickName !== undefined) {
    updates.nickName = scimUser.nickName;
  }

  // Preferred language
  if (scimUser.preferredLanguage !== undefined) {
    updates.preferredLanguage = scimUser.preferredLanguage;
  }

  // Email
  if (scimUser.emails && scimUser.emails.length > 0) {
    const primaryEmail = scimUser.emails.find(e => e.primary) || scimUser.emails[0];
    updates.email = primaryEmail.value;
  }

  // Phone
  if (scimUser.phoneNumbers && scimUser.phoneNumbers.length > 0) {
    const primaryPhone = scimUser.phoneNumbers.find(p => p.primary) || scimUser.phoneNumbers[0];
    updates.phone = primaryPhone.value;
  }

  // Active status
  if (scimUser.active !== undefined) {
    updates.active = scimUser.active;
  }

  return updates;
}

/**
 * Convert SCIM PATCH operations to Zitadel update data
 */
export function scimPatchToZitadelUpdate(patchOp: SCIMPatchOp) {
  const updates: any = {};

  for (const operation of patchOp.Operations) {
    const { op, path, value } = operation;

    // Handle different operation types
    if (op === 'replace' || op === 'add') {
      // Path-based updates
      if (path) {
        const normalizedPath = path.toLowerCase();

        if (normalizedPath === 'username') {
          updates.username = value;
        } else if (normalizedPath === 'name.givenname') {
          updates.firstName = value;
        } else if (normalizedPath === 'name.familyname') {
          updates.lastName = value;
        } else if (normalizedPath === 'displayname') {
          updates.displayName = value;
        } else if (normalizedPath === 'nickname') {
          updates.nickName = value;
        } else if (normalizedPath === 'preferredlanguage') {
          updates.preferredLanguage = value;
        } else if (normalizedPath === 'active') {
          updates.active = value;
        } else if (normalizedPath.startsWith('emails')) {
          if (Array.isArray(value)) {
            const primaryEmail = value.find((e: any) => e.primary) || value[0];
            if (primaryEmail) {
              updates.email = primaryEmail.value;
            }
          }
        } else if (normalizedPath.startsWith('phonenumbers')) {
          if (Array.isArray(value)) {
            const primaryPhone = value.find((p: any) => p.primary) || value[0];
            if (primaryPhone) {
              updates.phone = primaryPhone.value;
            }
          }
        }
      } else {
        // Bulk value update (no path specified)
        if (value && typeof value === 'object') {
          if (value.userName) updates.username = value.userName;
          if (value.name) {
            if (value.name.givenName) updates.firstName = value.name.givenName;
            if (value.name.familyName) updates.lastName = value.name.familyName;
          }
          if (value.displayName) updates.displayName = value.displayName;
          if (value.nickName) updates.nickName = value.nickName;
          if (value.preferredLanguage) updates.preferredLanguage = value.preferredLanguage;
          if (value.active !== undefined) updates.active = value.active;
          if (value.emails && Array.isArray(value.emails)) {
            const primaryEmail = value.emails.find((e: any) => e.primary) || value.emails[0];
            if (primaryEmail) updates.email = primaryEmail.value;
          }
          if (value.phoneNumbers && Array.isArray(value.phoneNumbers)) {
            const primaryPhone = value.phoneNumbers.find((p: any) => p.primary) || value.phoneNumbers[0];
            if (primaryPhone) updates.phone = primaryPhone.value;
          }
        }
      }
    } else if (op === 'remove') {
      // Handle remove operations
      if (path) {
        const normalizedPath = path.toLowerCase();
        
        if (normalizedPath === 'nickname') {
          updates.nickName = null;
        } else if (normalizedPath.startsWith('phonenumbers')) {
          updates.phone = null;
        }
        // Note: Some fields like username, email cannot be removed
      }
    }
  }

  return updates;
}

/**
 * Convert SCIM Group to Zitadel group/org creation data
 */
export function scimGroupToZitadelCreate(scimGroup: SCIMGroup) {
  const zitadelGroup: any = {
    name: scimGroup.displayName,
  };

  if (scimGroup.externalId) {
    zitadelGroup.externalId = scimGroup.externalId;
  }

  // Members
  if (scimGroup.members && scimGroup.members.length > 0) {
    zitadelGroup.members = scimGroup.members.map(member => ({
      userId: member.value,
      type: member.type || 'User',
    }));
  }

  return zitadelGroup;
}

/**
 * Convert SCIM Group to Zitadel group update data
 */
export function scimGroupToZitadelUpdate(scimGroup: SCIMGroup) {
  const updates: any = {};

  if (scimGroup.displayName !== undefined) {
    updates.name = scimGroup.displayName;
  }

  if (scimGroup.members !== undefined) {
    updates.members = scimGroup.members.map(member => ({
      userId: member.value,
      type: member.type || 'User',
    }));
  }

  return updates;
}
