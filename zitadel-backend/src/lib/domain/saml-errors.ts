/**
 * SAML Error Handling
 * 
 * SAML 2.0 error reasons and status codes
 * Based on Go: internal/domain/saml_error_reason.go
 */

/**
 * SAML Error Reason Enum
 * 
 * Maps to SAML 2.0 StatusCode values
 * Ref: https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf Section 3.2.2.2
 */
export enum SAMLErrorReason {
  UNSPECIFIED = 'urn:oasis:names:tc:SAML:2.0:status:Responder',
  VERSION_MISSMATCH = 'urn:oasis:names:tc:SAML:2.0:status:VersionMismatch',
  AUTH_N_FAILED = 'urn:oasis:names:tc:SAML:2.0:status:AuthnFailed',
  INVALID_ATTR_NAME_OR_VALUE = 'urn:oasis:names:tc:SAML:2.0:status:InvalidAttrNameOrValue',
  INVALID_NAMEID_POLICY = 'urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy',
  REQUEST_DENIED = 'urn:oasis:names:tc:SAML:2.0:status:RequestDenied',
  REQUEST_UNSUPPORTED = 'urn:oasis:names:tc:SAML:2.0:status:RequestUnsupported',
  UNSUPPORTED_BINDING = 'urn:oasis:names:tc:SAML:2.0:status:UnsupportedBinding',
  NO_PASSIVE = 'urn:oasis:names:tc:SAML:2.0:status:NoPassive',
  UNKNOWN_PRINCIPAL = 'urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal',
  NO_AUTHN_CONTEXT = 'urn:oasis:names:tc:SAML:2.0:status:NoAuthnContext',
}

/**
 * SAML Status Code (top-level)
 */
export enum SAMLStatusCode {
  SUCCESS = 'urn:oasis:names:tc:SAML:2.0:status:Success',
  REQUESTER = 'urn:oasis:names:tc:SAML:2.0:status:Requester',
  RESPONDER = 'urn:oasis:names:tc:SAML:2.0:status:Responder',
  VERSION_MISMATCH = 'urn:oasis:names:tc:SAML:2.0:status:VersionMismatch',
}

/**
 * SAML Error Response Data
 */
export interface SAMLErrorResponse {
  statusCode: SAMLStatusCode;
  statusMessage?: string;
  nestedStatusCode?: SAMLErrorReason;
  errorDescription?: string;
}

/**
 * Convert error reason to human-readable message
 */
export function errorReasonToMessage(reason: SAMLErrorReason): string {
  switch (reason) {
    case SAMLErrorReason.VERSION_MISSMATCH:
      return 'SAML version mismatch';
    case SAMLErrorReason.AUTH_N_FAILED:
      return 'Authentication failed';
    case SAMLErrorReason.INVALID_ATTR_NAME_OR_VALUE:
      return 'Invalid attribute name or value';
    case SAMLErrorReason.INVALID_NAMEID_POLICY:
      return 'Invalid NameID policy';
    case SAMLErrorReason.REQUEST_DENIED:
      return 'Request denied';
    case SAMLErrorReason.REQUEST_UNSUPPORTED:
      return 'Request unsupported';
    case SAMLErrorReason.UNSUPPORTED_BINDING:
      return 'Unsupported binding';
    case SAMLErrorReason.NO_PASSIVE:
      return 'Passive authentication not supported';
    case SAMLErrorReason.UNKNOWN_PRINCIPAL:
      return 'Unknown principal';
    case SAMLErrorReason.NO_AUTHN_CONTEXT:
      return 'No suitable authentication context';
    default:
      return 'An error occurred';
  }
}

/**
 * Generate SAML Error Response XML
 */
export function generateSAMLErrorResponse(
  inResponseTo: string,
  destination: string,
  issuer: string,
  error: SAMLErrorResponse
): string {
  const id = '_' + Math.random().toString(36).substring(2, 15);
  const issueInstant = new Date().toISOString();

  let statusXML = `
    <samlp:Status>
      <samlp:StatusCode Value="${error.statusCode}"`;

  // Add nested status code if provided
  if (error.nestedStatusCode) {
    statusXML += `>
        <samlp:StatusCode Value="${error.nestedStatusCode}" />
      </samlp:StatusCode>`;
  } else {
    statusXML += ` />`;
  }

  // Add status message if provided
  if (error.statusMessage || error.errorDescription) {
    const message = error.errorDescription || error.statusMessage || '';
    statusXML += `
      <samlp:StatusMessage>${escapeXml(message)}</samlp:StatusMessage>`;
  }

  statusXML += `
    </samlp:Status>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                ID="${id}"
                Version="2.0"
                IssueInstant="${issueInstant}"
                Destination="${escapeXml(destination)}"
                InResponseTo="${escapeXml(inResponseTo)}">
  <saml:Issuer>${escapeXml(issuer)}</saml:Issuer>
  ${statusXML}
</samlp:Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Map Zitadel error to SAML error
 */
export function mapZitadelErrorToSAML(errorCode: string, errorMessage?: string): SAMLErrorResponse {
  // Map specific Zitadel error codes to SAML errors
  
  // Check both code and message for SAML permission errors
  // Only map to REQUEST_DENIED if it's specifically a SAML permission error
  if (errorCode.startsWith('SAML-perm') || errorMessage?.includes('SAML-perm')) {
    return {
      statusCode: SAMLStatusCode.RESPONDER,
      nestedStatusCode: SAMLErrorReason.REQUEST_DENIED,
      statusMessage: 'Access denied',
    };
  }
  
  // Generic permission denied (not SAML-specific)
  if (errorCode === 'PERMISSION_DENIED') {
    return {
      statusCode: SAMLStatusCode.RESPONDER,
      nestedStatusCode: SAMLErrorReason.REQUEST_DENIED,
      statusMessage: 'Access denied',
    };
  }

  if (errorCode.includes('NotFound')) {
    return {
      statusCode: SAMLStatusCode.RESPONDER,
      nestedStatusCode: SAMLErrorReason.UNKNOWN_PRINCIPAL,
      statusMessage: 'User or application not found',
    };
  }

  if (errorCode.includes('Invalid')) {
    return {
      statusCode: SAMLStatusCode.REQUESTER,
      nestedStatusCode: SAMLErrorReason.INVALID_ATTR_NAME_OR_VALUE,
      statusMessage: 'Invalid request parameters',
    };
  }

  // Default error
  return {
    statusCode: SAMLStatusCode.RESPONDER,
    nestedStatusCode: SAMLErrorReason.UNSPECIFIED,
    statusMessage: 'An error occurred processing your request',
  };
}
