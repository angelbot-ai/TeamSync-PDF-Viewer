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
  | 'radio';

export type DateTimeFormat = 'date' | 'time' | 'datetime';

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
}

export interface FormAssignee {
  /** Unique assignee/role identifier (e.g. 'user_a', 'user_b') */
  id: string;
  /** Display label for this assignee (e.g. 'User A (Buyer)', 'User B (Reviewer)') */
  name: string;
  /** Hex color code for badges, borders and accents (e.g. '#2563eb') */
  color: string;
}

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
  | null;
