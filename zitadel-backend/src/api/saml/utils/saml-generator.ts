/**
 * SAML XML Generator
 * 
 * Generates SAML 2.0 compliant XML for responses and metadata
 */

import crypto from 'crypto';
import {
  SAMLResponse,
  SAMLAssertion,
  SAMLIdPMetadata,
  SAMLBinding,
  SAMLUserAttributes
} from '../types';

/**
 * Generate a random SAML ID
 */
export function generateSAMLID(): string {
  return '_' + crypto.randomBytes(21).toString('hex');
}

/**
 * Format date for SAML (ISO 8601)
 */
export function formatSAMLDate(date: Date): string {
  return date.toISOString();
}

/**
 * Generate SAML IdP Metadata XML
 */
export function generateIdPMetadata(config: SAMLIdPMetadata): string {
  const nameIDFormats = config.nameIDFormats
    .map(format => `    <md:NameIDFormat>${escapeXML(format)}</md:NameIDFormat>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${escapeXML(config.entityID)}">
  <md:IDPSSODescriptor 
      WantAuthnRequestsSigned="${config.wantAuthnRequestsSigned}"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${config.x509Certificate}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    
${nameIDFormats}
    
    <md:SingleSignOnService 
        Binding="${SAMLBinding.HTTP_POST}"
        Location="${escapeXML(config.singleSignOnServiceURL)}" />
    
    <md:SingleSignOnService 
        Binding="${SAMLBinding.HTTP_REDIRECT}"
        Location="${escapeXML(config.singleSignOnServiceURL)}" />
${config.singleLogoutServiceURL ? `    
    <md:SingleLogoutService 
        Binding="${SAMLBinding.HTTP_POST}"
        Location="${escapeXML(config.singleLogoutServiceURL)}" />` : ''}
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;
}

/**
 * Generate SAML Assertion XML
 */
export function generateAssertion(
  assertion: SAMLAssertion,
  userAttributes?: SAMLUserAttributes
): string {
  const attributes = userAttributes ? generateAttributeStatement(userAttributes) : '';

  return `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                   ID="${assertion.id}"
                   Version="2.0"
                   IssueInstant="${formatSAMLDate(assertion.issueInstant)}">
    <saml:Issuer>${escapeXML(assertion.issuer)}</saml:Issuer>
    
    <saml:Subject>
      <saml:NameID Format="${assertion.subject.nameIDFormat}">
        ${escapeXML(assertion.subject.nameID)}
      </saml:NameID>
      <saml:SubjectConfirmation Method="${assertion.subject.subjectConfirmation.method}">
        <saml:SubjectConfirmationData 
            InResponseTo="${assertion.subject.subjectConfirmation.subjectConfirmationData.inResponseTo}"
            Recipient="${escapeXML(assertion.subject.subjectConfirmation.subjectConfirmationData.recipient)}"
            NotOnOrAfter="${formatSAMLDate(assertion.subject.subjectConfirmation.subjectConfirmationData.notOnOrAfter)}" />
      </saml:SubjectConfirmation>
    </saml:Subject>
    
    <saml:Conditions 
        NotBefore="${formatSAMLDate(assertion.conditions.notBefore)}"
        NotOnOrAfter="${formatSAMLDate(assertion.conditions.notOnOrAfter)}">
      <saml:AudienceRestriction>
        ${assertion.conditions.audienceRestriction.map(aud => 
          `<saml:Audience>${escapeXML(aud)}</saml:Audience>`
        ).join('\n        ')}
      </saml:AudienceRestriction>
    </saml:Conditions>
    
    <saml:AuthnStatement 
        AuthnInstant="${formatSAMLDate(assertion.authnStatement.authnInstant)}"
        SessionIndex="${assertion.authnStatement.sessionIndex}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>
          ${assertion.authnStatement.authnContext.authnContextClassRef}
        </saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
${attributes}
  </saml:Assertion>`;
}

/**
 * Generate SAML Attribute Statement
 */
function generateAttributeStatement(attrs: SAMLUserAttributes): string {
  const attributes: string[] = [];

  // Standard attributes
  if (attrs.email) {
    attributes.push(createAttribute('email', 'Email', attrs.email));
  }
  if (attrs.username) {
    attributes.push(createAttribute('username', 'Username', attrs.username));
  }
  if (attrs.firstName) {
    attributes.push(createAttribute('firstName', 'First Name', attrs.firstName));
  }
  if (attrs.lastName) {
    attributes.push(createAttribute('lastName', 'Last Name', attrs.lastName));
  }
  if (attrs.displayName) {
    attributes.push(createAttribute('displayName', 'Display Name', attrs.displayName));
  }

  // Role/Groups (multi-valued)
  if (attrs.roles && attrs.roles.length > 0) {
    attributes.push(createMultiValueAttribute('roles', 'Roles', attrs.roles));
  }
  if (attrs.groups && attrs.groups.length > 0) {
    attributes.push(createMultiValueAttribute('groups', 'Groups', attrs.groups));
  }

  if (attributes.length === 0) {
    return '';
  }

  return `
    <saml:AttributeStatement>
${attributes.map(attr => `      ${attr}`).join('\n')}
    </saml:AttributeStatement>`;
}

/**
 * Create single-valued SAML attribute
 */
function createAttribute(name: string, friendlyName: string, value: string): string {
  return `<saml:Attribute Name="${escapeXML(name)}" FriendlyName="${escapeXML(friendlyName)}">
        <saml:AttributeValue>${escapeXML(value)}</saml:AttributeValue>
      </saml:Attribute>`;
}

/**
 * Create multi-valued SAML attribute
 */
function createMultiValueAttribute(name: string, friendlyName: string, values: string[]): string {
  const valueElements = values
    .map(v => `        <saml:AttributeValue>${escapeXML(v)}</saml:AttributeValue>`)
    .join('\n');

  return `<saml:Attribute Name="${escapeXML(name)}" FriendlyName="${escapeXML(friendlyName)}">
${valueElements}
      </saml:Attribute>`;
}

/**
 * Generate SAML Response XML
 */
export function generateSAMLResponse(
  response: SAMLResponse,
  userAttributes?: SAMLUserAttributes
): string {
  const assertionXML = response.assertion 
    ? generateAssertion(response.assertion, userAttributes)
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                ID="${response.id}"
                Version="2.0"
                IssueInstant="${formatSAMLDate(response.issueInstant)}"
                Destination="${escapeXML(response.destination)}"
                InResponseTo="${response.inResponseTo}">
  <saml:Issuer>${escapeXML(response.issuer)}</saml:Issuer>
  
  <samlp:Status>
    <samlp:StatusCode Value="${response.status.statusCode}" />
    ${response.status.statusMessage ? 
      `<samlp:StatusMessage>${escapeXML(response.status.statusMessage)}</samlp:StatusMessage>` 
      : ''}
  </samlp:Status>
  
  ${assertionXML}
</samlp:Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXML(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Base64 encode SAML response
 */
export function base64EncodeSAMLResponse(xmlResponse: string): string {
  return Buffer.from(xmlResponse, 'utf-8').toString('base64');
}

/**
 * Base64 decode SAML request
 */
export function base64DecodeSAMLRequest(encodedRequest: string): string {
  return Buffer.from(encodedRequest, 'base64').toString('utf-8');
}

/**
 * Parse SAML AuthnRequest (simplified for testing)
 */
export function parseSAMLAuthnRequest(xml: string): {
  id: string;
  issuer: string;
  acsURL: string;
} {
  // Simplified XML parsing for testing purposes
  // In production, use proper XML parser like xml2js or fast-xml-parser
  
  const idMatch = xml.match(/ID="([^"]+)"/);
  const issuerMatch = xml.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/);
  const acsMatch = xml.match(/AssertionConsumerServiceURL="([^"]+)"/);

  if (!idMatch || !issuerMatch || !acsMatch) {
    throw new Error('Invalid SAML AuthnRequest');
  }

  return {
    id: idMatch[1],
    issuer: issuerMatch[1],
    acsURL: acsMatch[1]
  };
}
