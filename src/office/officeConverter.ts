import type { OfficeConverterConfig, OfficeFileType } from './types';
import { getOfficeFileType, getOfficeMimeType } from './officeDetector';

// In-memory cache for converted PDF ArrayBuffers across document switches in the current session
const memoryCache = new Map<string, ArrayBuffer>();

/**
 * Computes a cache key for a document (string URL or File/Blob/Buffer).
 */
async function computeCacheKey(
  fileOrUrl: string | File | Blob | ArrayBuffer,
  fileType: OfficeFileType
): Promise<string> {
  if (typeof fileOrUrl === 'string') {
    return `office_cache:${fileType}:${fileOrUrl}`;
  }

  if (typeof (globalThis as any).File !== 'undefined' && fileOrUrl instanceof File) {
    return `office_cache:${fileType}:${fileOrUrl.name}:${fileOrUrl.size}:${fileOrUrl.lastModified}`;
  }

  if (typeof (globalThis as any).Blob !== 'undefined' && fileOrUrl instanceof Blob) {
    return `office_cache:${fileType}:blob:${fileOrUrl.size}:${fileOrUrl.type}`;
  }

  if (fileOrUrl instanceof ArrayBuffer) {
    return `office_cache:${fileType}:buffer:${fileOrUrl.byteLength}`;
  }

  return `office_cache:${fileType}:${String(fileOrUrl)}`;
}

/**
 * Retrieves a cached converted PDF from memory or sessionStorage.
 */
export async function getCachedOfficePdf(
  fileOrUrl: string | File | Blob | ArrayBuffer,
  fileType: OfficeFileType,
  cacheMode: OfficeConverterConfig['cache'] = 'memory'
): Promise<ArrayBuffer | null> {
  if (cacheMode === 'none' || cacheMode === false) return null;

  const key = await computeCacheKey(fileOrUrl, fileType);

  if (memoryCache.has(key)) {
    return memoryCache.get(key)!.slice(0);
  }

  if (cacheMode === 'session' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const base64 = window.sessionStorage.getItem(key);
      if (base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        memoryCache.set(key, bytes.buffer);
        return bytes.buffer;
      }
    } catch {
      // Ignore quota exceeded or storage errors
    }
  }

  return null;
}

/**
 * Stores a converted PDF in memory and optionally sessionStorage.
 */
export async function setCachedOfficePdf(
  fileOrUrl: string | File | Blob | ArrayBuffer,
  fileType: OfficeFileType,
  pdfBuffer: ArrayBuffer,
  cacheMode: OfficeConverterConfig['cache'] = 'memory'
): Promise<void> {
  if (cacheMode === 'none' || cacheMode === false) return;

  const key = await computeCacheKey(fileOrUrl, fileType);
  memoryCache.set(key, pdfBuffer.slice(0));

  if (cacheMode === 'session' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      // Only cache documents under 5MB in sessionStorage to avoid QuotaExceededError
      if (pdfBuffer.byteLength < 5 * 1024 * 1024) {
        const bytes = new Uint8Array(pdfBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
        }
        window.sessionStorage.setItem(key, btoa(binary));
      }
    } catch {
      // Ignore sessionStorage failure
    }
  }
}

/**
 * Clears the converted document cache.
 */
export function clearOfficeCache(): void {
  memoryCache.clear();
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith('office_cache:')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {}
  }
}

export interface ConvertOfficeDocumentResult {
  /** Raw PDF ArrayBuffer ready for PDF.js or downstream processing */
  pdfBuffer: ArrayBuffer;
  /** Browser Blob Object URL (e.g. blob:http...) ready for rendering or iframe preview */
  objectUrl: string;
  /** Whether the document was served from cache */
  fromCache: boolean;
}

/**
 * Converts an Office document (Word, PowerPoint, Excel) into a standardized PDF ArrayBuffer
 * and Blob URL using either a custom converter or the configured backend microservice.
 */
export async function convertOfficeDocument(
  fileOrUrl: string | File | Blob | ArrayBuffer,
  config: OfficeConverterConfig,
  fileName?: string
): Promise<ConvertOfficeDocumentResult> {
  const fileType = getOfficeFileType(fileOrUrl);
  if (!fileType) {
    throw new Error(
      `Unsupported Office document format. Expected .docx, .doc, .pptx, .ppt, .xlsx, or .xls.`
    );
  }

  // 1. Check cache first
  const cacheMode = config.cache ?? 'memory';
  const cached = await getCachedOfficePdf(fileOrUrl, fileType, cacheMode);
  if (cached) {
    const blob = new Blob([cached], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    return { pdfBuffer: cached, objectUrl, fromCache: true };
  }

  let pdfBuffer: ArrayBuffer;

  // 2. Custom conversion hook takes precedence if supplied
  if (config.convert) {
    const converted = await config.convert(fileOrUrl, fileType, {
      fileName,
      excelOptions: config.excelOptions,
    });

    if (typeof converted === 'string') {
      if (converted.startsWith('blob:') || converted.startsWith('data:') || converted.startsWith('http')) {
        const resp = await fetch(converted);
        pdfBuffer = await resp.arrayBuffer();
      } else {
        throw new Error(`Custom converter returned an invalid URL string: ${converted}`);
      }
    } else if (converted instanceof ArrayBuffer) {
      pdfBuffer = converted;
    } else if (converted instanceof Uint8Array) {
      const copy = new Uint8Array(converted.byteLength);
      copy.set(converted);
      pdfBuffer = copy.buffer;
    } else if (typeof Blob !== 'undefined' && converted instanceof Blob) {
      pdfBuffer = await converted.arrayBuffer();
    } else {
      throw new Error(`Custom converter returned an unsupported data type.`);
    }
  } else {
    // 3. Built-in HTTP backend conversion
    if (!config.endpoint) {
      throw new Error(
        `No conversion endpoint or custom converter configured. Please specify 'officeConverter.endpoint' in viewer options or provide a custom 'officeConverter.convert' function.`
      );
    }

    // Prepare headers
    let customHeaders: Record<string, string> = {};
    if (config.headers) {
      customHeaders = typeof config.headers === 'function' ? await config.headers() : config.headers;
    }

    // Resolve file content to Blob/File
    let uploadBlob: Blob;
    let uploadFileName = fileName || `document.${fileType}`;

    if (typeof fileOrUrl === 'string') {
      // Fetch source file from URL
      const sourceResp = await fetch(fileOrUrl);
      if (!sourceResp.ok) {
        throw new Error(
          `Failed to fetch Office document from URL: ${fileOrUrl} (HTTP ${sourceResp.status})`
        );
      }
      uploadBlob = await sourceResp.blob();
      if (!fileName) {
        const clean = fileOrUrl.split('#')[0].split('?')[0];
        const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
        if (lastSlash >= 0) {
          uploadFileName = clean.slice(lastSlash + 1);
        }
      }
    } else if (typeof (globalThis as any).File !== 'undefined' && fileOrUrl instanceof File) {
      uploadBlob = fileOrUrl;
      uploadFileName = fileOrUrl.name;
    } else if (typeof (globalThis as any).Blob !== 'undefined' && fileOrUrl instanceof Blob) {
      uploadBlob = fileOrUrl;
    } else if (fileOrUrl instanceof ArrayBuffer) {
      uploadBlob = new Blob([fileOrUrl], { type: getOfficeMimeType(fileType) });
    } else {
      throw new Error('Unsupported Office document input source.');
    }

    // Construct FormData.
    // Gotenberg standard format: files / files[0]
    // General multipart proxies: 'file' or 'files'
    const formData = new FormData();
    formData.append('files', uploadBlob, uploadFileName);
    formData.append('file', uploadBlob, uploadFileName);

    if (config.excelOptions) {
      if (config.excelOptions.fitToPageWidth) {
        formData.append('fitToPageWidth', 'true');
      }
      if (config.excelOptions.includeGridlines) {
        formData.append('includeGridlines', 'true');
      }
    }

    const convertResp = await fetch(config.endpoint, {
      method: 'POST',
      headers: customHeaders,
      body: formData,
    });

    if (!convertResp.ok) {
      let errorDetail = '';
      try {
        errorDetail = await convertResp.text();
      } catch {}
      throw new Error(
        `Document conversion service failed with HTTP ${convertResp.status}: ${errorDetail || convertResp.statusText}`
      );
    }

    pdfBuffer = await convertResp.arrayBuffer();
  }

  // 4. Save to cache
  await setCachedOfficePdf(fileOrUrl, fileType, pdfBuffer, cacheMode);

  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);

  return {
    pdfBuffer,
    objectUrl,
    fromCache: false,
  };
}
