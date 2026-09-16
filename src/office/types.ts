export type OfficeFileType = 'docx' | 'doc' | 'pptx' | 'ppt' | 'xlsx' | 'xls';

export type OfficeDocumentCategory = 'word' | 'powerpoint' | 'excel';

export interface OfficeBadgeMeta {
  category: OfficeDocumentCategory;
  name: string;
  extension: string;
  brandColor: string;
  darkBrandColor: string;
  iconName: string;
}

export type OfficeConversionState = 'idle' | 'converting' | 'converted' | 'error';

export interface OfficeConverterConfig {
  /**
   * Backend conversion endpoint URL (e.g. Gotenberg, custom API proxy, or serverless function).
   * Example: 'http://localhost:3000/api/convert-office' or 'http://localhost:3001/forms/libreoffice/convert'
   */
  endpoint?: string;

  /**
   * Custom HTTP headers to include with the conversion request.
   */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);

  /**
   * Authorization token (Bearer token, API key, or JWT) sent with conversion requests.
   * Can be a static string or a function/promise returning the current token.
   * Automatically injected as 'Authorization: Bearer <token>' header.
   */
  authToken?: string | (() => string | Promise<string>);

  /**
   * Caching strategy:
   * - 'memory': Cache converted PDF ArrayBuffers in browser memory for the current session (default).
   * - 'session': Cache in sessionStorage.
   * - 'none': Do not cache.
   */
  cache?: 'memory' | 'session' | 'none' | boolean;

  /**
   * Custom conversion hook allowing host application to supply its own conversion logic.
   * If provided, this hook is called instead of the built-in Gotenberg/HTTP dispatcher.
   */
  convert?: (
    fileOrUrl: string | File | Blob | ArrayBuffer,
    fileType: OfficeFileType,
    options?: { fileName?: string; excelOptions?: OfficeConverterConfig['excelOptions'] }
  ) => Promise<ArrayBuffer | Uint8Array | Blob | string>;

  /**
   * Options for Excel worksheet conversion.
   */
  excelOptions?: {
    fitToPageWidth?: boolean;
    includeGridlines?: boolean;
    paperSize?: 'A4' | 'Letter' | 'Legal';
    orientation?: 'landscape' | 'portrait';
  };
}

export interface OfficeDocumentInfo {
  fileType: OfficeFileType;
  category: OfficeDocumentCategory;
  fileName?: string;
  originalUrl?: string;
  mimeType: string;
}

/**
 * Alias for OfficeConverterConfig for ergonomic naming.
 */
export type OfficeConversionConfig = OfficeConverterConfig;

/**
 * Alias for OfficeDocumentInfo / options.
 */
export type OfficeDocumentOptions = OfficeDocumentInfo;

