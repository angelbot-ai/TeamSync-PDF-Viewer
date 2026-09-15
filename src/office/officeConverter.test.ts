import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  convertOfficeDocument,
  getCachedOfficePdf,
  setCachedOfficePdf,
  clearOfficeCache,
} from './officeConverter';

describe('officeConverter', () => {
  beforeEach(() => {
    clearOfficeCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearOfficeCache();
  });

  describe('caching', () => {
    it('stores and retrieves PDF buffers from memory cache', async () => {
      const dummyBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const url = 'https://example.com/doc.docx';

      expect(await getCachedOfficePdf(url, 'docx', 'memory')).toBeNull();

      await setCachedOfficePdf(url, 'docx', dummyBuffer, 'memory');
      const retrieved = await getCachedOfficePdf(url, 'docx', 'memory');

      expect(retrieved).not.toBeNull();
      expect(new Uint8Array(retrieved!)).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it('bypasses cache when cache option is "none" or false', async () => {
      const dummyBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const url = 'https://example.com/doc.docx';

      await setCachedOfficePdf(url, 'docx', dummyBuffer, 'none');
      expect(await getCachedOfficePdf(url, 'docx', 'none')).toBeNull();
    });
  });

  describe('convertOfficeDocument with customConverter', () => {
    it('uses custom converter function when supplied', async () => {
      const fakePdfBytes = new Uint8Array([37, 80, 68, 70]).buffer; // '%PDF'
      const customConvert = vi.fn().mockResolvedValue(fakePdfBytes);

      const result = await convertOfficeDocument(
        'presentation.pptx',
        { convert: customConvert },
        'presentation.pptx'
      );

      expect(customConvert).toHaveBeenCalledWith('presentation.pptx', 'pptx', {
        fileName: 'presentation.pptx',
        excelOptions: undefined,
      });
      expect(result.pdfBuffer).toEqual(fakePdfBytes);
      expect(result.fromCache).toBe(false);
      expect(result.objectUrl).toMatch(/^blob:/);

      // Subsequent call should hit cache and NOT invoke customConvert again
      const cachedResult = await convertOfficeDocument(
        'presentation.pptx',
        { convert: customConvert },
        'presentation.pptx'
      );
      expect(cachedResult.fromCache).toBe(true);
      expect(customConvert).toHaveBeenCalledTimes(1);
    });

    it('handles custom converter returning Uint8Array or ArrayBuffer', async () => {
      const uint8 = new Uint8Array([10, 20, 30]);
      const result = await convertOfficeDocument('data.xlsx', {
        convert: async () => uint8,
      });
      expect(new Uint8Array(result.pdfBuffer)).toEqual(uint8);
    });
  });

  describe('convertOfficeDocument with HTTP endpoint', () => {
    it('posts multipart form data to endpoint and returns PDF result', async () => {
      const mockPdfData = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
      const fileBlob = new Blob(['sample-office-data'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Mock fetch
      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === 'https://convert.example.com/forms/libreoffice/convert') {
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => mockPdfData.buffer,
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });
      globalThis.fetch = fetchMock;

      const result = await convertOfficeDocument(fileBlob, {
        endpoint: 'https://convert.example.com/forms/libreoffice/convert',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.fromCache).toBe(false);
      expect(new Uint8Array(result.pdfBuffer)).toEqual(mockPdfData);
    });

    it('throws descriptive error if endpoint returns non-200 status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'LibreOffice process crashed',
      });

      const file = new File(['dummy'], 'broken.docx', { type: 'application/msword' });

      await expect(
        convertOfficeDocument(file, {
          endpoint: 'https://convert.example.com/convert',
        })
      ).rejects.toThrow(/Document conversion service failed with HTTP 500: LibreOffice process crashed/);
    });

    it('throws error if neither endpoint nor custom converter is provided', async () => {
      await expect(
        convertOfficeDocument('spreadsheet.xlsx', {})
      ).rejects.toThrow(/No conversion endpoint or custom converter configured/);
    });
  });
});
