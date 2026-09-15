import type {
  OfficeFileType,
  OfficeDocumentCategory,
  OfficeBadgeMeta,
  OfficeDocumentInfo,
} from './types';

const MIME_MAP: Record<string, OfficeFileType> = {
  // Word
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  // PowerPoint
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  // Excel
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
};

const EXTENSION_MAP: Record<string, OfficeFileType> = {
  docx: 'docx',
  doc: 'doc',
  pptx: 'pptx',
  ppt: 'ppt',
  xlsx: 'xlsx',
  xls: 'xls',
};

/**
 * Extracts file extension from a URL, path, or filename, taking into account query parameters,
 * hash fragments, and standard file paths.
 */
function extractExtension(pathOrUrl: string): string | null {
  try {
    const clean = pathOrUrl.split('#')[0].split('?')[0];

    // If the path itself is an API conversion endpoint, it serves PDF output directly
    if (clean.endsWith('/api/convert') || clean.endsWith('/convert')) {
      return null;
    }

    // 1. Check for filename param in hash or query (e.g., #filename=report.docx or ?filename=report.docx)
    const urlMatch = pathOrUrl.match(/[?&#](?:filename|file|name)=([^&#]+)/i);
    if (urlMatch && urlMatch[1]) {
      const decoded = decodeURIComponent(urlMatch[1]);
      const ext = extractExtensionFromSimpleName(decoded);
      if (ext) return ext;
    }

    // 2. Check path portion without query or hash
    return extractExtensionFromSimpleName(clean);
  } catch {
    return null;
  }
}

function extractExtensionFromSimpleName(name: string): string | null {
  const lastSlash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  const filename = lastSlash >= 0 ? name.slice(lastSlash + 1) : name;
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) return null;
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Detects whether a string URL, File, or Blob represents a supported Microsoft Office document.
 */
export function getOfficeFileType(target: unknown): OfficeFileType | null {
  if (!target) return null;

  // File or Blob instance
  if (typeof (globalThis as any).Blob !== 'undefined' && target instanceof Blob) {
    if (typeof (globalThis as any).File !== 'undefined' && target instanceof File && target.name) {
      const ext = extractExtension(target.name);
      if (ext && ext in EXTENSION_MAP) {
        return EXTENSION_MAP[ext];
      }
    }
    if (target.type && target.type in MIME_MAP) {
      return MIME_MAP[target.type];
    }
    return null;
  }

  // String URL or filename
  if (typeof target === 'string') {
    const ext = extractExtension(target);
    if (ext && ext in EXTENSION_MAP) {
      return EXTENSION_MAP[ext];
    }
  }

  return null;
}

/**
 * Returns true if the given input is a supported Microsoft Office document.
 */
export function isOfficeDocument(target: unknown): boolean {
  return getOfficeFileType(target) !== null;
}

/**
 * Returns the broad document category ('word' | 'powerpoint' | 'excel') for an Office file type.
 */
export function getOfficeDocumentCategory(fileType: OfficeFileType): OfficeDocumentCategory {
  switch (fileType) {
    case 'docx':
    case 'doc':
      return 'word';
    case 'pptx':
    case 'ppt':
      return 'powerpoint';
    case 'xlsx':
    case 'xls':
      return 'excel';
  }
}

/**
 * Returns standard MIME type for an Office file type.
 */
export function getOfficeMimeType(fileType: OfficeFileType): string {
  switch (fileType) {
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
  }
}

/**
 * Metadata used to display themed UI badges, spinners, and icons for Office document types.
 */
export function getOfficeBadgeMeta(fileType: OfficeFileType): OfficeBadgeMeta {
  const category = getOfficeDocumentCategory(fileType);
  switch (category) {
    case 'word':
      return {
        category: 'word',
        name: fileType === 'docx' ? 'Word Document (.docx)' : 'Word Document (.doc)',
        extension: fileType.toUpperCase(),
        brandColor: '#185abd',
        darkBrandColor: '#103f91',
        iconName: 'word',
      };
    case 'powerpoint':
      return {
        category: 'powerpoint',
        name: fileType === 'pptx' ? 'PowerPoint Presentation (.pptx)' : 'PowerPoint Presentation (.ppt)',
        extension: fileType.toUpperCase(),
        brandColor: '#d24726',
        darkBrandColor: '#9b2e15',
        iconName: 'powerpoint',
      };
    case 'excel':
      return {
        category: 'excel',
        name: fileType === 'xlsx' ? 'Excel Workbook (.xlsx)' : 'Excel Spreadsheet (.xls)',
        extension: fileType.toUpperCase(),
        brandColor: '#107c41',
        darkBrandColor: '#094e28',
        iconName: 'excel',
      };
  }
}

/**
 * Inspects a target and returns rich Office metadata if it is an Office document.
 */
export function getOfficeDocumentInfo(target: unknown): OfficeDocumentInfo | null {
  const fileType = getOfficeFileType(target);
  if (!fileType) return null;

  const category = getOfficeDocumentCategory(fileType);
  const mimeType = getOfficeMimeType(fileType);

  let fileName: string | undefined;
  let originalUrl: string | undefined;

  if (typeof (globalThis as any).File !== 'undefined' && target instanceof File) {
    fileName = target.name;
  } else if (typeof target === 'string') {
    originalUrl = target;
    const clean = target.split('#')[0].split('?')[0];
    const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
    fileName = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  }

  return {
    fileType,
    category,
    fileName,
    originalUrl,
    mimeType,
  };
}
