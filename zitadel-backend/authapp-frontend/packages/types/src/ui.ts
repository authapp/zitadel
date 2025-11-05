/**
 * UI-related type definitions
 */

// Component sizes
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Component variants
export type ComponentVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link';

// Button types
export interface ButtonProps {
  variant?: ComponentVariant;
  size?: ComponentSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

// Form field state
export interface FieldState {
  value: any;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

// Form state
export interface FormState<T extends Record<string, any> = Record<string, any>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Table column definition
export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string | number;
  render?: (value: any, row: T) => any; // Returns renderable content
  align?: 'left' | 'center' | 'right';
}

// Modal props
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: ComponentSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

// Toast/Notification types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Menu item
export interface MenuItem {
  id: string;
  label: string;
  icon?: any; // Icon component or element
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  children?: MenuItem[];
}

// Breadcrumb
export interface Breadcrumb {
  label: string;
  href?: string;
  current?: boolean;
}

// Tab
export interface Tab {
  id: string;
  label: string;
  content?: any; // Tab content component or element
  disabled?: boolean;
  badge?: string | number;
}

// Loading state
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// Theme
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  mode: ThemeMode;
  primaryColor?: string;
  accentColor?: string;
}
