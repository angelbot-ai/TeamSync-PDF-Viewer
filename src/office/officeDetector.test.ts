import { describe, it, expect } from 'vitest';
import {
  getOfficeFileType,
  isOfficeDocument,
  getOfficeDocumentCategory,
  getOfficeMimeType,
  getOfficeBadgeMeta,
  getOfficeDocumentInfo,
} from './officeDetector';

describe('officeDetector', () => {
  describe('getOfficeFileType and isOfficeDocument', () => {
    it('detects Word documents (.docx, .doc)', () => {
      expect(getOfficeFileType('https://example.com/docs/annual-report.docx')).toBe('docx');
      expect(getOfficeFileType('/path/to/legacy-document.doc')).toBe('doc');
      expect(getOfficeFileType('UPPERCASE.DOCX')).toBe('docx');
      expect(isOfficeDocument('annual-report.docx')).toBe(true);
    });

    it('detects PowerPoint presentations (.pptx, .ppt)', () => {
      expect(getOfficeFileType('https://example.com/slides/quarterly-review.pptx')).toBe('pptx');
      expect(getOfficeFileType('slides.ppt')).toBe('ppt');
      expect(isOfficeDocument('deck.pptx')).toBe(true);
    });

    it('detects Excel spreadsheets (.xlsx, .xls)', () => {
      expect(getOfficeFileType('https://example.com/finances/budget2026.xlsx')).toBe('xlsx');
      expect(getOfficeFileType('balance.xls')).toBe('xls');
      expect(isOfficeDocument('data.xlsx')).toBe(true);
    });

    it('detects extensions even with query parameters or hash fragments', () => {
      expect(
        getOfficeFileType('https://s3.amazonaws.com/bucket/report.docx?AWSAccessKeyId=123&Expires=456')
      ).toBe('docx');
      expect(
        getOfficeFileType('blob:http://localhost:3000/123-abc#filename=presentation.pptx')
      ).toBe('pptx');
      expect(
        getOfficeFileType('https://api.example.com/download?file=financials.xlsx&v=2')
      ).toBe('xlsx');
    });

    it('detects File objects by name', () => {
      const file = new File(['dummy'], 'contract.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(getOfficeFileType(file)).toBe('docx');
      expect(isOfficeDocument(file)).toBe(true);
    });

    it('detects Blob objects by MIME type', () => {
      const blob = new Blob(['dummy'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(getOfficeFileType(blob)).toBe('xlsx');
      expect(isOfficeDocument(blob)).toBe(true);
    });

    it('returns null for non-Office formats (PDF, images, etc.)', () => {
      expect(getOfficeFileType('document.pdf')).toBeNull();
      expect(getOfficeFileType('image.png')).toBeNull();
      expect(getOfficeFileType('')).toBeNull();
      expect(getOfficeFileType(null)).toBeNull();
      expect(getOfficeFileType(undefined)).toBeNull();
      expect(isOfficeDocument('document.pdf')).toBe(false);
    });
  });

  describe('getOfficeDocumentCategory', () => {
    it('maps file types to categories correctly', () => {
      expect(getOfficeDocumentCategory('docx')).toBe('word');
      expect(getOfficeDocumentCategory('doc')).toBe('word');
      expect(getOfficeDocumentCategory('pptx')).toBe('powerpoint');
      expect(getOfficeDocumentCategory('ppt')).toBe('powerpoint');
      expect(getOfficeDocumentCategory('xlsx')).toBe('excel');
      expect(getOfficeDocumentCategory('xls')).toBe('excel');
    });
  });

  describe('getOfficeMimeType', () => {
    it('returns standard MIME types', () => {
      expect(getOfficeMimeType('docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(getOfficeMimeType('pptx')).toBe(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      expect(getOfficeMimeType('xlsx')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });
  });

  describe('getOfficeBadgeMeta', () => {
    it('returns brand colors and badge details', () => {
      const wordMeta = getOfficeBadgeMeta('docx');
      expect(wordMeta.brandColor).toBe('#185abd');
      expect(wordMeta.extension).toBe('DOCX');
      expect(wordMeta.category).toBe('word');

      const pptMeta = getOfficeBadgeMeta('pptx');
      expect(pptMeta.brandColor).toBe('#d24726');
      expect(pptMeta.extension).toBe('PPTX');
      expect(pptMeta.category).toBe('powerpoint');

      const excelMeta = getOfficeBadgeMeta('xlsx');
      expect(excelMeta.brandColor).toBe('#107c41');
      expect(excelMeta.extension).toBe('XLSX');
      expect(excelMeta.category).toBe('excel');
    });
  });

  describe('getOfficeDocumentInfo', () => {
    it('returns comprehensive metadata for valid Office documents', () => {
      const info = getOfficeDocumentInfo('https://example.com/docs/budget.xlsx?token=abc');
      expect(info).not.toBeNull();
      expect(info?.fileType).toBe('xlsx');
      expect(info?.category).toBe('excel');
      expect(info?.fileName).toBe('budget.xlsx');
    });

    it('returns null for standard PDFs', () => {
      expect(getOfficeDocumentInfo('sample.pdf')).toBeNull();
    });
  });
});
