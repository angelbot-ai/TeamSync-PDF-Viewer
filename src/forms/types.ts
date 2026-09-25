/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Types and interfaces for the PDF Forms Builder and Form Filler engine.
 */

export type FormFieldType =
  | 'text'
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
