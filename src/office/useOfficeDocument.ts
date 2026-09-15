/**
 * TeamSync PDF Viewer SDK — Office Pre-Conversion Hook & Helper
 *
 * Implements the Host-Side component of the Enterprise Hybrid Architecture:
 * Allows host applications to pre-convert Office documents before mounting
 * the viewer, cache results, inspect conversion state, and pass ready-to-view
 * PDF URLs directly to <TeamSyncViewer fileUrl={pdfUrl} />.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { isOfficeDocument, getOfficeFileType, getOfficeDocumentInfo } from './officeDetector';
import { convertOfficeDocument, getCachedOfficePdf } from './officeConverter';
import type { OfficeConverterConfig, OfficeFileType, OfficeDocumentInfo } from './types';

export interface UseOfficeDocumentOptions {
  /** Converter configuration (endpoint, authToken, cache mode, etc.) */
  converterConfig?: OfficeConverterConfig;
  /** Optional file name override */
  fileName?: string;
  /** Whether to automatically convert when the document changes (defaults to true) */
  autoConvert?: boolean;
}

export interface UseOfficeDocumentResult {
  /** Whether the input source was identified as a Microsoft Office document */
  isOffice: boolean;
  /** Detected office file type ('docx', 'pptx', 'xlsx', etc.) or null if PDF */
  fileType: OfficeFileType | null;
  /** Detailed metadata about the office document */
  documentInfo: OfficeDocumentInfo | null;
  /** Whether conversion is actively in progress */
  isConverting: boolean;
  /** The final PDF URL ready for the viewer (<TeamSyncViewer fileUrl={pdfUrl} />) */
  pdfUrl: string | null;
  /** Raw PDF ArrayBuffer */
  pdfBuffer: ArrayBuffer | null;
  /** Whether the document was served from memory/session cache */
  fromCache: boolean;
  /** Any error encountered during conversion */
  error: Error | null;
  /** Manually trigger conversion or retry */
  convert: () => Promise<string | null>;
}

/**
 * React hook that pre-converts Office documents into viewable PDF URLs before viewer mounting.
 * If the input is already a PDF, it passes through immediately with `isConverting: false`.
 */
export function useOfficeDocument(
  fileOrUrl: string | File | Blob | ArrayBuffer | null | undefined,
  options: UseOfficeDocumentOptions = {}
): UseOfficeDocumentResult {
  const { autoConvert = true } = options;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(() => {
    // If initially given a string URL that is NOT an office doc, initialize immediately
    if (typeof fileOrUrl === 'string' && !isOfficeDocument(fileOrUrl)) {
      return fileOrUrl;
    }
    return null;
  });
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createdObjectUrlRef = useRef<string | null>(null);

  const isOffice = fileOrUrl ? isOfficeDocument(fileOrUrl) : false;
  const fileType = fileOrUrl ? getOfficeFileType(fileOrUrl) : null;
  const documentInfo = fileOrUrl ? getOfficeDocumentInfo(fileOrUrl) : null;

  const cleanupUrl = useCallback(() => {
    if (createdObjectUrlRef.current) {
      URL.revokeObjectURL(createdObjectUrlRef.current);
      createdObjectUrlRef.current = null;
    }
  }, []);

  const runConversion = useCallback(async (): Promise<string | null> => {
    if (!fileOrUrl) {
      cleanupUrl();
      setPdfUrl(null);
      setPdfBuffer(null);
      return null;
    }

    const { converterConfig = {}, fileName } = optionsRef.current;

    // Pass through PDFs directly
    if (!isOffice) {
      if (typeof fileOrUrl === 'string') {
        cleanupUrl();
        setPdfUrl(fileOrUrl);
        setPdfBuffer(null);
        setFromCache(false);
        setError(null);
        return fileOrUrl;
      }
      if (typeof (globalThis as any).Blob !== 'undefined' && fileOrUrl instanceof Blob) {
        cleanupUrl();
        const url = URL.createObjectURL(fileOrUrl);
        createdObjectUrlRef.current = url;
        setPdfUrl(url);
        setFromCache(false);
        setError(null);
        return url;
      }
      return null;
    }

    setIsConverting(true);
    setError(null);

    try {
      const result = await convertOfficeDocument(fileOrUrl, converterConfig, fileName);
      cleanupUrl();
      createdObjectUrlRef.current = result.objectUrl;

      setPdfUrl(result.objectUrl);
      setPdfBuffer(result.pdfBuffer);
      setFromCache(result.fromCache);
      setIsConverting(false);
      return result.objectUrl;
    } catch (err: any) {
      const convertedError = err instanceof Error ? err : new Error(String(err));
      setError(convertedError);
      setIsConverting(false);
      return null;
    }
  }, [fileOrUrl, isOffice, cleanupUrl]);

  useEffect(() => {
    if (autoConvert && fileOrUrl) {
      runConversion();
    }
    return () => {
      cleanupUrl();
    };
  }, [fileOrUrl, autoConvert, runConversion, cleanupUrl]);

  return {
    isOffice,
    fileType,
    documentInfo,
    isConverting,
    pdfUrl,
    pdfBuffer,
    fromCache,
    error,
    convert: runConversion,
  };
}

/**
 * Standalone asynchronous preloader for Office documents.
 * Can be called anywhere (e.g. in loaders, event handlers, or background tasks).
 */
export async function preloadOfficeDocument(
  fileOrUrl: string | File | Blob | ArrayBuffer,
  config: OfficeConverterConfig,
  fileName?: string
): Promise<{
  pdfUrl: string;
  pdfBuffer: ArrayBuffer;
  fromCache: boolean;
  fileType: OfficeFileType | 'pdf';
}> {
  if (!isOfficeDocument(fileOrUrl)) {
    if (typeof fileOrUrl === 'string') {
      const resp = await fetch(fileOrUrl);
      const buffer = await resp.arrayBuffer();
      return { pdfUrl: fileOrUrl, pdfBuffer: buffer, fromCache: false, fileType: 'pdf' };
    }
    if (typeof (globalThis as any).Blob !== 'undefined' && fileOrUrl instanceof Blob) {
      const buffer = await fileOrUrl.arrayBuffer();
      const url = URL.createObjectURL(fileOrUrl);
      return { pdfUrl: url, pdfBuffer: buffer, fromCache: false, fileType: 'pdf' };
    }
    if (fileOrUrl instanceof ArrayBuffer) {
      const blob = new Blob([fileOrUrl], { type: 'application/pdf' });
      return { pdfUrl: URL.createObjectURL(blob), pdfBuffer: fileOrUrl, fromCache: false, fileType: 'pdf' };
    }
  }

  const fileType = getOfficeFileType(fileOrUrl) || 'docx';
  const result = await convertOfficeDocument(fileOrUrl, config, fileName);

  return {
    pdfUrl: result.objectUrl,
    pdfBuffer: result.pdfBuffer,
    fromCache: result.fromCache,
    fileType,
  };
}
