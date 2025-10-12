/**
 * Flow Domain Types
 * 
 * Trigger flows and actions configuration
 * Based on Go: internal/domain/flow.go
 */

/**
 * Flow State enumeration
 */
export enum FlowState {
  ACTIVE = 0,
  INACTIVE = 1,
}

/**
 * Flow Type enumeration
 */
export enum FlowType {
  UNSPECIFIED = 0,
  EXTERNAL_AUTHENTICATION = 1,
  CUSTOMISE_TOKEN = 2,
  INTERNAL_AUTHENTICATION = 3,
  CUSTOMIZE_SAML_RESPONSE = 4,
}

/**
 * Trigger Type enumeration
 */
export enum TriggerType {
  UNSPECIFIED = 0,
  POST_AUTHENTICATION = 1,
  PRE_CREATION = 2,
  POST_CREATION = 3,
  PRE_USERINFO_CREATION = 4,
  PRE_ACCESS_TOKEN_CREATION = 5,
  PRE_SAML_RESPONSE_CREATION = 6,
}

/**
 * Check if flow type is valid
 */
export function isFlowTypeValid(flowType: FlowType): boolean {
  return flowType > FlowType.UNSPECIFIED && flowType <= FlowType.CUSTOMIZE_SAML_RESPONSE;
}

/**
 * Check if trigger type is valid
 */
export function isTriggerTypeValid(triggerType: TriggerType): boolean {
  return triggerType >= TriggerType.UNSPECIFIED && triggerType <= TriggerType.PRE_SAML_RESPONSE_CREATION;
}

/**
 * Get trigger types for a flow type
 */
export function getFlowTriggerTypes(flowType: FlowType): TriggerType[] {
  switch (flowType) {
    case FlowType.EXTERNAL_AUTHENTICATION:
      return [
        TriggerType.POST_AUTHENTICATION,
        TriggerType.PRE_CREATION,
        TriggerType.POST_CREATION,
      ];
    case FlowType.CUSTOMISE_TOKEN:
      return [
        TriggerType.PRE_USERINFO_CREATION,
        TriggerType.PRE_ACCESS_TOKEN_CREATION,
      ];
    case FlowType.INTERNAL_AUTHENTICATION:
      return [
        TriggerType.POST_AUTHENTICATION,
        TriggerType.PRE_CREATION,
        TriggerType.POST_CREATION,
      ];
    case FlowType.CUSTOMIZE_SAML_RESPONSE:
      return [TriggerType.PRE_SAML_RESPONSE_CREATION];
    default:
      return [];
  }
}

/**
 * Check if flow type has trigger type
 */
export function flowTypeHasTrigger(flowType: FlowType, triggerType: TriggerType): boolean {
  const triggers = getFlowTriggerTypes(flowType);
  return triggers.includes(triggerType);
}

/**
 * Get all flow types
 */
export function getAllFlowTypes(): FlowType[] {
  return [
    FlowType.EXTERNAL_AUTHENTICATION,
    FlowType.CUSTOMISE_TOKEN,
    FlowType.INTERNAL_AUTHENTICATION,
    FlowType.CUSTOMIZE_SAML_RESPONSE,
  ];
}
