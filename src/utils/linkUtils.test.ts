/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { parseLinkTarget, isDocumentUrl, sanitizeLinkUrl } from './linkUtils';

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

    it('returns false for external non-pdf websites and protocol-relative links', () => {
      expect(isDocumentUrl('https://google.com')).toBe(false);
      expect(isDocumentUrl('http://teamsync.link/about')).toBe(false);
      expect(isDocumentUrl('//evil.com')).toBe(false);
      expect(isDocumentUrl('//phishing.site/login')).toBe(false);
      expect(isDocumentUrl('')).toBe(false);
    });

    it('recognizes protocol-relative pdf links as documents', () => {
      expect(isDocumentUrl('//cdn.example.com/file.pdf')).toBe(true);
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

    it('identifies protocol-relative web URLs as external web', () => {
      expect(parseLinkTarget('//evil.com/phishing')).toEqual({
        rawUrl: '//evil.com/phishing',
        isInternalPage: false,
        docUrl: '//evil.com/phishing',
        pageNumber: undefined,
        isExternalWeb: true
      });
    });
  });

  describe('sanitizeLinkUrl (SEC-04)', () => {
    it('rejects javascript: and script execution schemes', () => {
      expect(sanitizeLinkUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeLinkUrl('JAVASCRIPT:alert(document.cookie)')).toBe('#');
      expect(sanitizeLinkUrl('  javascript:void(0)  ')).toBe('#');
    });

    it('rejects data: and vbscript: URIs', () => {
      expect(sanitizeLinkUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
      expect(sanitizeLinkUrl('vbscript:msgbox(1)')).toBe('#');
      expect(sanitizeLinkUrl('file:///etc/passwd')).toBe('#');
    });

    it('permits safe HTTP, HTTPS, mailto, tel, and relative links', () => {
      expect(sanitizeLinkUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeLinkUrl('http://example.com/doc.pdf')).toBe('http://example.com/doc.pdf');
      expect(sanitizeLinkUrl('mailto:support@teamsync.com')).toBe('mailto:support@teamsync.com');
      expect(sanitizeLinkUrl('tel:+1234567890')).toBe('tel:+1234567890');
      expect(sanitizeLinkUrl('/docs/guide.pdf')).toBe('/docs/guide.pdf');
      expect(sanitizeLinkUrl('./sample.pdf')).toBe('./sample.pdf');
    });

    it('permits internal page jump anchors', () => {
      expect(sanitizeLinkUrl('#page=5')).toBe('#page=5');
      expect(sanitizeLinkUrl('#3')).toBe('#3');
    });

    it('normalizes protocol-relative URLs safely to https', () => {
      expect(sanitizeLinkUrl('//example.com/page')).toBe('https://example.com/page');
    });

    it('handles empty or undefined inputs safely', () => {
      expect(sanitizeLinkUrl('')).toBe('#');
      expect(sanitizeLinkUrl(undefined)).toBe('#');
    });
  });
});
