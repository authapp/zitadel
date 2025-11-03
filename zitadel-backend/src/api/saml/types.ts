/**
 * SAML Identity Provider Types
 * 
 * Types for SAML 2.0 Identity Provider implementation
 * Where Zitadel acts as the IdP for external Service Providers
 */

/**
 * SAML Binding Types
 */
export enum SAMLBinding {
  HTTP_POST = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
  HTTP_REDIRECT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
  SOAP = 'urn:oasis:names:tc:SAML:2.0:bindings:SOAP'
}

/**
 * SAML Name ID Format
 */
export enum SAMLNameIDFormat {
  UNSPECIFIED = 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
  EMAIL = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  PERSISTENT = 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
  TRANSIENT = 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
  ENTITY = 'urn:oasis:names:tc:SAML:2.0:nameid-format:entity'
}

/**
 * SAML Status Codes
 */
export enum SAMLStatusCode {
  SUCCESS = 'urn:oasis:names:tc:SAML:2.0:status:Success',
  REQUESTER = 'urn:oasis:names:tc:SAML:2.0:status:Requester',
  RESPONDER = 'urn:oasis:names:tc:SAML:2.0:status:Responder',
  VERSION_MISMATCH = 'urn:oasis:names:tc:SAML:2.0:status:VersionMismatch',
  AUTHN_FAILED = 'urn:oasis:names:tc:SAML:2.0:status:AuthnFailed',
  INVALID_ATTR_NAME_OR_VALUE = 'urn:oasis:names:tc:SAML:2.0:status:InvalidAttrNameOrValue',
  INVALID_NAMEID_POLICY = 'urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy',
  NO_AUTHN_CONTEXT = 'urn:oasis:names:tc:SAML:2.0:status:NoAuthnContext',
  NO_AVAILABLE_IDP = 'urn:oasis:names:tc:SAML:2.0:status:NoAvailableIDP',
  NO_PASSIVE = 'urn:oasis:names:tc:SAML:2.0:status:NoPassive',
  NO_SUPPORTED_IDP = 'urn:oasis:names:tc:SAML:2.0:status:NoSupportedIDP',
  PARTIAL_LOGOUT = 'urn:oasis:names:tc:SAML:2.0:status:PartialLogout',
  PROXY_COUNT_EXCEEDED = 'urn:oasis:names:tc:SAML:2.0:status:ProxyCountExceeded',
  REQUEST_DENIED = 'urn:oasis:names:tc:SAML:2.0:status:RequestDenied',
  REQUEST_UNSUPPORTED = 'urn:oasis:names:tc:SAML:2.0:status:RequestUnsupported',
  REQUEST_VERSION_DEPRECATED = 'urn:oasis:names:tc:SAML:2.0:status:RequestVersionDeprecated',
  REQUEST_VERSION_TOO_HIGH = 'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooHigh',
  REQUEST_VERSION_TOO_LOW = 'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooLow',
  RESOURCE_NOT_RECOGNIZED = 'urn:oasis:names:tc:SAML:2.0:status:ResourceNotRecognized',
  TOO_MANY_RESPONSES = 'urn:oasis:names:tc:SAML:2.0:status:TooManyResponses',
  UNKNOWN_ATTR_PROFILE = 'urn:oasis:names:tc:SAML:2.0:status:UnknownAttrProfile',
  UNKNOWN_PRINCIPAL = 'urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal',
  UNSUPPORTED_BINDING = 'urn:oasis:names:tc:SAML:2.0:status:UnsupportedBinding'
}

/**
 * SAML Authentication Request (from SP)
 */
export interface SAMLAuthRequest {
  id: string;
  issueInstant: Date;
  destination: string;
  assertionConsumerServiceURL: string;
  protocolBinding?: SAMLBinding;
  issuer: string;
  nameIDPolicy?: {
    format?: SAMLNameIDFormat;
    allowCreate?: boolean;
  };
  forceAuthn?: boolean;
  isPassive?: boolean;
}

/**
 * SAML Response (to SP)
 */
export interface SAMLResponse {
  id: string;
  inResponseTo: string;
  issueInstant: Date;
  destination: string;
  issuer: string;
  status: {
    statusCode: SAMLStatusCode;
    statusMessage?: string;
  };
  assertion?: SAMLAssertion;
}

/**
 * SAML Assertion
 */
export interface SAMLAssertion {
  id: string;
  issueInstant: Date;
  issuer: string;
  subject: {
    nameID: string;
    nameIDFormat: SAMLNameIDFormat;
    subjectConfirmation: {
      method: string;
      subjectConfirmationData: {
        inResponseTo: string;
        recipient: string;
        notOnOrAfter: Date;
      };
    };
  };
  conditions: {
    notBefore: Date;
    notOnOrAfter: Date;
    audienceRestriction: string[];
  };
  authnStatement: {
    authnInstant: Date;
    sessionIndex: string;
    authnContext: {
      authnContextClassRef: string;
    };
  };
  attributeStatement?: SAMLAttribute[];
}

/**
 * SAML Attribute
 */
export interface SAMLAttribute {
  name: string;
  nameFormat?: string;
  friendlyName?: string;
  attributeValue: string | string[];
}

/**
 * SAML IdP Metadata Configuration
 */
export interface SAMLIdPMetadata {
  entityID: string;
  singleSignOnServiceURL: string;
  singleLogoutServiceURL?: string;
  x509Certificate: string;
  nameIDFormats: SAMLNameIDFormat[];
  wantAuthnRequestsSigned: boolean;
}

/**
 * User attributes for SAML assertion
 */
export interface SAMLUserAttributes {
  userID: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  roles?: string[];
  groups?: string[];
  [key: string]: any;
}
