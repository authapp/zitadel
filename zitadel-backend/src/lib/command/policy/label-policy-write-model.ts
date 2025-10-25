/**
 * Label Policy Write Model
 * 
 * Tracks branding/theming policy state for command execution
 * Supports both org-level and instance-level label policies
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * Label policy state
 */
export enum LabelPolicyState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
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
 * Label policy write model - tracks branding configuration
 */
export class LabelPolicyWriteModel extends WriteModel {
  state: LabelPolicyState = LabelPolicyState.UNSPECIFIED;
  isDefault: boolean = false;
  
  // Light mode colors
  primaryColor?: string;
  backgroundColor?: string;
  warnColor?: string;
  fontColor?: string;
  
  // Dark mode colors
  primaryColorDark?: string;
  backgroundColorDark?: string;
  warnColorDark?: string;
  fontColorDark?: string;
  
  // Assets
  logoURL?: string;
  iconURL?: string;
  logoURLDark?: string;
  iconURLDark?: string;
  fontURL?: string;
  
  // Settings
  hideLoginNameSuffix: boolean = false;
  errorMsgPopup: boolean = false;
  disableWatermark: boolean = false;
  themeMode: string = ThemeMode.AUTO;
  
  constructor(aggregateType: string = 'org') {
    super(aggregateType);
  }
  
  /**
   * Check if policy exists
   */
  exists(): boolean {
    return this.state === LabelPolicyState.ACTIVE;
  }
  
  /**
   * Reduce event into write model state
   */
  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.label.policy.added':
      case 'instance.label.policy.added':
        this.handleLabelPolicyAdded(event);
        break;
        
      case 'org.label.policy.changed':
      case 'instance.label.policy.changed':
        this.handleLabelPolicyChanged(event);
        break;
        
      case 'org.label.policy.removed':
        this.handleLabelPolicyRemoved(event);
        break;
        
      case 'org.removed':
      case 'instance.removed':
        this.state = LabelPolicyState.REMOVED;
        break;
    }
  }
  
  private handleLabelPolicyAdded(event: Event): void {
    this.state = LabelPolicyState.ACTIVE;
    this.isDefault = event.eventType.includes('instance.');
    
    const payload = event.payload || {};
    
    // Light mode colors
    this.primaryColor = payload.primaryColor || '#5469d4';
    this.backgroundColor = payload.backgroundColor || '#ffffff';
    this.warnColor = payload.warnColor || '#ff3b5b';
    this.fontColor = payload.fontColor || '#000000';
    
    // Dark mode colors
    this.primaryColorDark = payload.primaryColorDark || '#2073c4';
    this.backgroundColorDark = payload.backgroundColorDark || '#111827';
    this.warnColorDark = payload.warnColorDark || '#ff3b5b';
    this.fontColorDark = payload.fontColorDark || '#ffffff';
    
    // Assets
    this.logoURL = payload.logoURL;
    this.iconURL = payload.iconURL;
    this.logoURLDark = payload.logoURLDark;
    this.iconURLDark = payload.iconURLDark;
    this.fontURL = payload.fontURL;
    
    // Settings
    this.hideLoginNameSuffix = payload.hideLoginNameSuffix ?? false;
    this.errorMsgPopup = payload.errorMsgPopup ?? false;
    this.disableWatermark = payload.disableWatermark ?? false;
    this.themeMode = payload.themeMode || ThemeMode.AUTO;
  }
  
  private handleLabelPolicyChanged(event: Event): void {
    const payload = event.payload || {};
    
    // Update only provided fields
    if (payload.primaryColor !== undefined) {
      this.primaryColor = payload.primaryColor;
    }
    if (payload.backgroundColor !== undefined) {
      this.backgroundColor = payload.backgroundColor;
    }
    if (payload.warnColor !== undefined) {
      this.warnColor = payload.warnColor;
    }
    if (payload.fontColor !== undefined) {
      this.fontColor = payload.fontColor;
    }
    if (payload.primaryColorDark !== undefined) {
      this.primaryColorDark = payload.primaryColorDark;
    }
    if (payload.backgroundColorDark !== undefined) {
      this.backgroundColorDark = payload.backgroundColorDark;
    }
    if (payload.warnColorDark !== undefined) {
      this.warnColorDark = payload.warnColorDark;
    }
    if (payload.fontColorDark !== undefined) {
      this.fontColorDark = payload.fontColorDark;
    }
    if (payload.logoURL !== undefined) {
      this.logoURL = payload.logoURL;
    }
    if (payload.iconURL !== undefined) {
      this.iconURL = payload.iconURL;
    }
    if (payload.logoURLDark !== undefined) {
      this.logoURLDark = payload.logoURLDark;
    }
    if (payload.iconURLDark !== undefined) {
      this.iconURLDark = payload.iconURLDark;
    }
    if (payload.fontURL !== undefined) {
      this.fontURL = payload.fontURL;
    }
    if (payload.hideLoginNameSuffix !== undefined) {
      this.hideLoginNameSuffix = payload.hideLoginNameSuffix;
    }
    if (payload.errorMsgPopup !== undefined) {
      this.errorMsgPopup = payload.errorMsgPopup;
    }
    if (payload.disableWatermark !== undefined) {
      this.disableWatermark = payload.disableWatermark;
    }
    if (payload.themeMode !== undefined) {
      this.themeMode = payload.themeMode;
    }
  }
  
  private handleLabelPolicyRemoved(_event: Event): void {
    this.state = LabelPolicyState.REMOVED;
  }
  
  /**
   * Check if any changes would be made
   */
  hasChanged(data: Partial<LabelPolicyData>): boolean {
    if (data.primaryColor !== undefined && data.primaryColor !== this.primaryColor) return true;
    if (data.backgroundColor !== undefined && data.backgroundColor !== this.backgroundColor) return true;
    if (data.warnColor !== undefined && data.warnColor !== this.warnColor) return true;
    if (data.fontColor !== undefined && data.fontColor !== this.fontColor) return true;
    if (data.primaryColorDark !== undefined && data.primaryColorDark !== this.primaryColorDark) return true;
    if (data.backgroundColorDark !== undefined && data.backgroundColorDark !== this.backgroundColorDark) return true;
    if (data.warnColorDark !== undefined && data.warnColorDark !== this.warnColorDark) return true;
    if (data.fontColorDark !== undefined && data.fontColorDark !== this.fontColorDark) return true;
    if (data.logoURL !== undefined && data.logoURL !== this.logoURL) return true;
    if (data.iconURL !== undefined && data.iconURL !== this.iconURL) return true;
    if (data.logoURLDark !== undefined && data.logoURLDark !== this.logoURLDark) return true;
    if (data.iconURLDark !== undefined && data.iconURLDark !== this.iconURLDark) return true;
    if (data.fontURL !== undefined && data.fontURL !== this.fontURL) return true;
    if (data.hideLoginNameSuffix !== undefined && data.hideLoginNameSuffix !== this.hideLoginNameSuffix) return true;
    if (data.errorMsgPopup !== undefined && data.errorMsgPopup !== this.errorMsgPopup) return true;
    if (data.disableWatermark !== undefined && data.disableWatermark !== this.disableWatermark) return true;
    if (data.themeMode !== undefined && data.themeMode !== this.themeMode) return true;
    
    return false;
  }
}

/**
 * Label policy data interface
 */
export interface LabelPolicyData {
  // Light mode colors
  primaryColor?: string;
  backgroundColor?: string;
  warnColor?: string;
  fontColor?: string;
  
  // Dark mode colors
  primaryColorDark?: string;
  backgroundColorDark?: string;
  warnColorDark?: string;
  fontColorDark?: string;
  
  // Assets
  logoURL?: string;
  iconURL?: string;
  logoURLDark?: string;
  iconURLDark?: string;
  fontURL?: string;
  
  // Settings
  hideLoginNameSuffix?: boolean;
  errorMsgPopup?: boolean;
  disableWatermark?: boolean;
  themeMode?: string;
}
