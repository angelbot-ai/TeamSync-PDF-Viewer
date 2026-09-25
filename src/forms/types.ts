/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Types and interfaces for the PDF Forms Builder and Form Filler engine.
 */

export type FormFieldType =
  | 'text'
  | 'textbox'
  | 'textarea'
  | 'datetime'
  | 'checklist'
  | 'checkbox'
  | 'dropdown'
  | 'radio'
  | 'signature'
  | 'digital_signature';

export type DateTimeFormat = 'date' | 'time' | 'datetime';

export type SignatureType = 'electronic' | 'digital';

export interface FormSignatureValue {
  type: SignatureType;
  /** PNG data URL for drawn, typed, or uploaded electronic signatures */
  dataUrl?: string;
  /** Name of the actual signer */
  signerName?: string;
  /** Optional email of the actual signer */
  signerEmail?: string;
  /** Optional role identifier or title fulfilled by the signer */
  signerRole?: string;
  /** Signing epoch timestamp */
  timestamp?: number;
  /** Purpose/reason for digital signing */
  reason?: string;
  /** Cryptographic thumbprint/hash preview for digital signature */
  certificateHash?: string;
}

export interface FormField {
  /** Unique identifier for the form field element */
  id: string;
  /** Field name identifier used when extracting form values or submitting (e.g. "applicant_name") */
  name: string;
  /** Form field type */
  type: FormFieldType;
  /** 1-based page index where this field resides */
  pageIndex: number;
  /** X coordinate in PDF page user space (points, 72 DPI) */
  x: number;
  /** Y coordinate in PDF page user space (points, 72 DPI) */
  y: number;
  /** Width in PDF page user space (points, 72 DPI) */
  width: number;
  /** Height in PDF page user space (points, 72 DPI) */
  height: number;
  /** Human-readable label displayed for the field */
  label?: string;
  /** Placeholder text for text-based inputs */
  placeholder?: string;
  /** Whether filling this field is required */
  required?: boolean;
  /** Default pre-populated value */
  defaultValue?: any;
  /** Current filled value */
  value?: any;
  /** List of selectable option strings for checklist, dropdown, or radio fields */
  options?: string[];
  /** Date/time picker format mode */
  dateFormat?: DateTimeFormat;
  /** Whether the field is locked against user input in filler mode */
  readOnly?: boolean;
  /** Foreground text color (hex or CSS color string, e.g. '#0f172a') */
  textColor?: string;
  /** Background fill color (hex, rgba, or 'transparent') */
  backgroundColor?: string;
  /** Custom border color (defaults to assignee color or neutral #94a3b8) */
  borderColor?: string;
  /** Border stroke width in pixels (1, 2, or 3) */
  borderWidth?: number;
  /** Corner border radius in pixels (0, 3, 6, 12) */
  borderRadius?: number;
  /** Font family for inputs, labels and choices (e.g. 'sans-serif', 'serif', 'monospace', 'cursive') */
  fontFamily?: string;
  /** Base font size in unscaled points (e.g. 10, 12, 14, 16, 18, 20) */
  fontSize?: number;
  /** Font weight */
  fontWeight?: 'normal' | 'bold';
  /** Font style */
  fontStyle?: 'normal' | 'italic';
  /** Text alignment */
  textAlign?: 'left' | 'center' | 'right';
  /** Assignee identifier responsible for filling this field (references FormAssignee.id) */
  assigneeId?: string;
  /** Explicit step order in the form filling sequence (1, 2, 3...) */
  flowOrder?: number;
  /** Specific signature mode: electronic or digital */
  signatureType?: SignatureType;
  /** Custom tag text displayed on the 'Sign Here' flag badge (e.g. 'Sign Here', 'Authorized Signature') */
  signTagText?: string;
}

/**
 * FormRole represents a role/slot defined in a document form template
 * (e.g. 'applicant', 'tenant', 'landlord', 'reviewer', 'user_a').
 * The form template assigns fields to roles; the host application passes the actual user details.
 */
export interface FormRole {
  /** Unique role identifier (e.g. 'applicant', 'tenant', 'landlord', 'user_a') */
  id: string;
  /** Display label for this role (e.g. 'Applicant', 'Tenant', 'Landlord') */
  name: string;
  /** Hex color code for badges, borders and accents (e.g. '#2563eb') */
  color: string;
  /** Optional human-readable description for the role */
  description?: string;
}

/** FormAssignee is an alias for FormRole for backward compatibility. */
export type FormAssignee = FormRole;

export type FormDataRecord = Record<string, any>;

export interface FormValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export type FormToolType =
  | 'select'
  | 'textbox'
  | 'textarea'
  | 'datetime'
  | 'checklist'
  | 'dropdown'
  | 'radio'
  | 'signature'
  | 'digital_signature'
  | null;

/**
 * Options controlling which form features and UI controls are accessible to the user.
 * Allows host applications to programmatically control form filling, design permissions,
 * user persona switching, and feature visibility.
 */
export interface FormFeatureOptions {
  /**
   * Allow designing / creating form fields in the Forms builder tab.
   * When false, the Forms tab is hidden or disabled.
   * Default: true (or matches SDKPermissions.canCreateForms).
   */
  canCreateForms?: boolean;

  /**
   * Allow filling interactive form fields in the View tab.
   * When false, all form inputs and signatures are read-only.
   * Default: true (or matches SDKPermissions.canFillForms).
   */
  canFillForms?: boolean;

  /**
   * Whether the end-user can switch personas in the filler toolbar.
   * When false, the user selector dropdown is locked to the assigned user.
   * Default: true.
   */
  allowUserSwitching?: boolean;

  /**
   * Show or hide the "Filling as:" user selector in the filler toolbar.
   * Default: true.
   */
  showUserSelector?: boolean;

  /**
   * Show or hide the persistent Post-it Signature Sticky / Index Flags on the side of the viewer.
   * Default: true.
   */
  showSignatureFlags?: boolean;

  /**
   * Show or hide the step-by-step form flow navigation buttons (Previous / Step X of Y / Next).
   * Default: true.
   */
  showFlowNavigation?: boolean;

  /**
   * Show or hide the "Validate" button and validation message in the filler toolbar.
   * Default: true.
   */
  showValidation?: boolean;

  /**
   * Show or hide the "Reset" / clear form button in the filler toolbar.
   * Default: true.
   */
  showReset?: boolean;

  /**
   * Show or hide the download / export filled PDF button in the filler toolbar.
   * Default: true.
   */
  showExport?: boolean;

  /**
   * Controls how form fields assigned to OTHER users are presented:
   * - 'locked': rendered with disabled styling and a lock indicator badge (default)
   * - 'hidden': completely hidden from view for the current user
   * - 'view-only': rendered cleanly as read-only values without lock styling
   */
  otherUserFieldsMode?: 'locked' | 'hidden' | 'view-only';

  /**
   * Hide the entire FormFillerActions toolbar in View mode.
   * Default: false.
   */
  hideToolbar?: boolean;

  /**
   * Active form role identifier for form filling (e.g. 'applicant', 'tenant', 'user_a').
   * Controls which fields and signature flags are active for the current user.
   */
  currentRole?: string | null;
}
