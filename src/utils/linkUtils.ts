/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

export interface ParsedLinkTarget {
  /** Raw input URL or link target string. */
  rawUrl: string;
  /** True if the link refers only to an internal page jump within the current document (e.g. '#page=5' or '#5'). */
  isInternalPage: boolean;
  /** Clean document URL without page hash if referencing another document (e.g. 'supporting.pdf' or 'https://.../doc.pdf'). */
  docUrl?: string;
  /** Target page number (1-based) if specified (e.g. 5 from '#page=5' or 'doc.pdf#page=5'). */
  pageNumber?: number;
  /** True if this is an external web URL (e.g. 'https://google.com') that is not a PDF/document. */
  isExternalWeb: boolean;
}

/**
 * Checks whether a given URL or filename refers to a PDF / document rather than a general web page.
 */
export function isDocumentUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();

  // Custom document schemes
  if (/^(doc|pdf|file):/i.test(trimmed)) return true;

  // Strip query strings and hash anchors for extension checking
  const cleanPath = trimmed.split(/[?#]/)[0].toLowerCase();

  // Direct .pdf extension
  if (cleanPath.endsWith('.pdf')) return true;

  // Protocol-relative URLs (e.g. '//evil.com') are external web links unless explicitly pointing to a PDF
  if (trimmed.startsWith('//')) {
    return cleanPath.endsWith('.pdf') || cleanPath.endsWith('/pdf') || /[?&]format=pdf(&|$)/i.test(trimmed);
  }

  // Relative file paths (e.g. 'docs/contract', './exhibits/a.pdf')
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    // If it has no scheme / protocol, it's a relative path / filename
    return true;
  }

  // REST-like PDF endpoints (e.g. '/api/documents/123/pdf' or '?format=pdf')
  if (cleanPath.endsWith('/pdf') || /[?&]format=pdf(&|$)/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Parses any link URL into structured destination information, extracting target documents and page numbers.
 */
export function parseLinkTarget(linkUrl: string): ParsedLinkTarget {
  const raw = (linkUrl || '').trim();
  if (!raw) {
    return {
      rawUrl: raw,
      isInternalPage: false,
      isExternalWeb: false
    };
  }

  // 1. Pure internal anchor: '#page=5' or '#5'
  if (raw.startsWith('#')) {
    const pageMatch = raw.match(/^#(?:page=)?(\d+)$/i);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
    return {
      rawUrl: raw,
      isInternalPage: true,
      pageNumber: pageNumber && pageNumber > 0 ? pageNumber : undefined,
      isExternalWeb: false
    };
  }

  // 2. Custom document schemes: 'doc:supporting.pdf#page=3' or 'pdf:supporting.pdf'
  let normalizedUrl = raw;
  if (/^(doc|pdf):/i.test(raw)) {
    normalizedUrl = raw.replace(/^(doc|pdf):/i, '');
  }

  // 3. Extract page hash if present: 'path/doc.pdf#page=4' or 'path/doc.pdf#4'
  let docUrl = normalizedUrl;
  let pageNumber: number | undefined;

  const hashIndex = normalizedUrl.indexOf('#');
  if (hashIndex !== -1) {
    const hash = normalizedUrl.slice(hashIndex);
    docUrl = normalizedUrl.slice(0, hashIndex);
    const pageMatch = hash.match(/^#(?:page=)?(\d+)$/i);
    if (pageMatch) {
      pageNumber = parseInt(pageMatch[1], 10);
      if (isNaN(pageNumber) || pageNumber <= 0) {
        pageNumber = undefined;
      }
    }
  }

  const isDoc = isDocumentUrl(docUrl);
  const isWeb = (/^https?:\/\//i.test(docUrl) || docUrl.startsWith('//')) && !isDoc;

  return {
    rawUrl: raw,
    isInternalPage: false,
    docUrl: isDoc || isWeb ? docUrl : docUrl,
    pageNumber,
    isExternalWeb: isWeb
  };
}

/**
 * Sanitizes a link URL to guarantee safe usage in anchor attributes (e.g. href).
 * Rejects dangerous schemes like javascript:, vbscript:, and data:.
 * Returns '#' if the scheme is unsafe or empty.
 */
export function sanitizeLinkUrl(url?: string): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (!trimmed) return '#';

  // Allow internal anchors e.g. '#page=2', '#5'
  if (trimmed.startsWith('#')) return trimmed;

  // Normalize protocol-relative URL
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }

  // Reject explicitly dangerous schemes
  if (/^(javascript|vbscript|data|file):/i.test(trimmed)) {
    return '#';
  }

  // If already absolute http/https/mailto/tel, return trimmed
  if (/^(https?|mailto|tel):/i.test(trimmed)) {
    return trimmed;
  }

  // If relative path (/docs/sample.pdf, ./sample.pdf, ../sample.pdf)
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }

  // If no scheme, treat as relative
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  // Any other unknown custom scheme: reject
  return '#';
}
