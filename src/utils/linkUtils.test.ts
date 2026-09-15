/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { parseLinkTarget, isDocumentUrl } from './linkUtils';

describe('linkUtils', () => {
  describe('isDocumentUrl', () => {
    it('recognizes PDF files and paths', () => {
      expect(isDocumentUrl('contract.pdf')).toBe(true);
      expect(isDocumentUrl('/docs/exhibit-a.pdf')).toBe(true);
      expect(isDocumentUrl('https://example.com/file.pdf')).toBe(true);
      expect(isDocumentUrl('https://example.com/file.pdf?token=123')).toBe(true);
      expect(isDocumentUrl('https://example.com/file.pdf#page=2')).toBe(true);
    });

    it('recognizes custom document schemes', () => {
      expect(isDocumentUrl('doc:supporting.pdf')).toBe(true);
      expect(isDocumentUrl('pdf:exhibit.pdf')).toBe(true);
      expect(isDocumentUrl('file:///path/to/doc.pdf')).toBe(true);
    });

    it('recognizes relative paths without protocol as documents', () => {
      expect(isDocumentUrl('supporting-doc')).toBe(true);
      expect(isDocumentUrl('./docs/exhibit')).toBe(true);
    });

    it('recognizes REST endpoints returning pdf', () => {
      expect(isDocumentUrl('https://example.com/api/document/123/pdf')).toBe(true);
      expect(isDocumentUrl('https://example.com/api/document?format=pdf')).toBe(true);
    });

    it('returns false for external non-pdf websites', () => {
      expect(isDocumentUrl('https://google.com')).toBe(false);
      expect(isDocumentUrl('http://teamsync.link/about')).toBe(false);
      expect(isDocumentUrl('')).toBe(false);
    });
  });

  describe('parseLinkTarget', () => {
    it('handles empty input', () => {
      expect(parseLinkTarget('')).toEqual({
        rawUrl: '',
        isInternalPage: false,
        isExternalWeb: false
      });
    });

    it('parses internal page anchors (#page=N and #N)', () => {
      expect(parseLinkTarget('#page=5')).toEqual({
        rawUrl: '#page=5',
        isInternalPage: true,
        pageNumber: 5,
        isExternalWeb: false
      });

      expect(parseLinkTarget('#12')).toEqual({
        rawUrl: '#12',
        isInternalPage: true,
        pageNumber: 12,
        isExternalWeb: false
      });

      expect(parseLinkTarget('#invalid')).toEqual({
        rawUrl: '#invalid',
        isInternalPage: true,
        pageNumber: undefined,
        isExternalWeb: false
      });
    });

    it('parses document links with target page numbers', () => {
      expect(parseLinkTarget('supporting.pdf#page=3')).toEqual({
        rawUrl: 'supporting.pdf#page=3',
        isInternalPage: false,
        docUrl: 'supporting.pdf',
        pageNumber: 3,
        isExternalWeb: false
      });

      expect(parseLinkTarget('https://cdn.example.com/docs/exhibit.pdf#page=10')).toEqual({
        rawUrl: 'https://cdn.example.com/docs/exhibit.pdf#page=10',
        isInternalPage: false,
        docUrl: 'https://cdn.example.com/docs/exhibit.pdf',
        pageNumber: 10,
        isExternalWeb: false
      });

      expect(parseLinkTarget('doc:annex.pdf#page=7')).toEqual({
        rawUrl: 'doc:annex.pdf#page=7',
        isInternalPage: false,
        docUrl: 'annex.pdf',
        pageNumber: 7,
        isExternalWeb: false
      });
    });

    it('parses document links without page numbers', () => {
      expect(parseLinkTarget('appendix.pdf')).toEqual({
        rawUrl: 'appendix.pdf',
        isInternalPage: false,
        docUrl: 'appendix.pdf',
        pageNumber: undefined,
        isExternalWeb: false
      });
    });

    it('identifies external web URLs', () => {
      expect(parseLinkTarget('https://google.com')).toEqual({
        rawUrl: 'https://google.com',
        isInternalPage: false,
        docUrl: 'https://google.com',
        pageNumber: undefined,
        isExternalWeb: true
      });
    });
  });
});
