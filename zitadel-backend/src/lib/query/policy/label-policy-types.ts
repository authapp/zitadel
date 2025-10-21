/**
 * Label Policy Types
 * Controls branding and theming (colors, logos, fonts)
 * Based on Zitadel Go internal/query/label_policy.go
 */

/**
 * Label policy configuration for branding
 */
export interface LabelPolicy {
  id: string;
  instanceID: string;
  organizationID?: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  
  // Colors
  primaryColor: string;              // Primary brand color (hex)
  backgroundColor: string;           // Background color (hex)
  warnColor: string;                 // Warning color (hex)
  fontColor: string;                 // Font color (hex)
  primaryColorDark: string;          // Primary color for dark mode (hex)
  backgroundColorDark: string;       // Background for dark mode (hex)
  warnColorDark: string;             // Warning color for dark mode (hex)
  fontColorDark: string;             // Font color for dark mode (hex)
  
  // Logos and icons
  logoURL?: string;                  // Logo URL
  iconURL?: string;                  // Icon URL
  logoURLDark?: string;              // Logo for dark mode
  iconURLDark?: string;              // Icon for dark mode
  
  // Font
  fontURL?: string;                  // Custom font URL
  
  // Settings
  hideLoginNameSuffix: boolean;      // Hide @domain suffix on login
  errorMsgPopup: boolean;            // Show errors as popup vs inline
  disableWatermark: boolean;         // Disable Zitadel watermark
  themeMode: ThemeMode;              // Theme mode setting
  
  // State
  isDefault: boolean;
  resourceOwner: string;
}

/**
 * Theme mode options
 */
export enum ThemeMode {
  AUTO = 'auto',
  LIGHT = 'light',
  DARK = 'dark',
}

/**
 * Default label policy settings
 */
export const DEFAULT_LABEL_POLICY: Partial<LabelPolicy> = {
  primaryColor: '#5469d4',
  backgroundColor: '#ffffff',
  warnColor: '#ff3b5b',
  fontColor: '#000000',
  primaryColorDark: '#2073c4',
  backgroundColorDark: '#111827',
  warnColorDark: '#ff3b5b',
  fontColorDark: '#ffffff',
  hideLoginNameSuffix: false,
  errorMsgPopup: false,
  disableWatermark: false,
  themeMode: ThemeMode.AUTO,
};

/**
 * Active label policy (combines org and instance)
 */
export interface ActiveLabelPolicy extends LabelPolicy {
  activateUsers: boolean;            // Whether users are auto-activated
}
