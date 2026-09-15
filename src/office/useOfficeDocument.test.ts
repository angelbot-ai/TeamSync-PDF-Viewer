/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useOfficeDocument, preloadOfficeDocument } from './useOfficeDocument';
import { clearOfficeCache } from './officeConverter';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('useOfficeDocument and preloadOfficeDocument', () => {
  beforeEach(() => {
    clearOfficeCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearOfficeCache();
  });

  it('preloadOfficeDocument pre-converts Office documents', async () => {
    const fakePdfBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]).buffer; // %PDF-1.4
    const customConvert = vi.fn().mockResolvedValue(fakePdfBuffer);

    const result = await preloadOfficeDocument('report.docx', {
      convert: customConvert,
    });

    expect(result.fileType).toBe('docx');
    expect(result.fromCache).toBe(false);
    expect(result.pdfBuffer).toEqual(fakePdfBuffer);
    expect(result.pdfUrl).toMatch(/^blob:/);
    expect(customConvert).toHaveBeenCalledTimes(1);
  });

  it('preloadOfficeDocument passes through standard PDF Blobs', async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    const result = await preloadOfficeDocument(pdfBlob, {});
    expect(result.fileType).toBe('pdf');
    expect(result.fromCache).toBe(false);
    expect(result.pdfUrl).toMatch(/^blob:/);
  });

  it('useOfficeDocument hook handles Office conversion in a React component', async () => {
    const fakePdfBuffer = new Uint8Array([37, 80, 68, 70]).buffer;
    const customConvert = vi.fn().mockResolvedValue(fakePdfBuffer);

    let capturedState: any = null;

    function TestComponent({ file }: { file: string }) {
      const state = useOfficeDocument(file, {
        converterConfig: { convert: customConvert },
      });
      capturedState = state;
      return React.createElement('div', null, state.pdfUrl || 'loading');
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent, { file: 'financials.xlsx' }));
    });

    expect(capturedState.isOffice).toBe(true);
    expect(capturedState.fileType).toBe('xlsx');
    expect(capturedState.documentInfo?.category).toBe('excel');

    // Wait for async conversion promise
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(capturedState.isConverting).toBe(false);
    expect(capturedState.pdfUrl).toMatch(/^blob:/);
    expect(capturedState.error).toBeNull();
    expect(customConvert).toHaveBeenCalledTimes(1);

    // Unmount and verify cleanup
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('useOfficeDocument hook passes standard PDF URLs immediately', async () => {
    let capturedState: any = null;

    function TestComponent({ file }: { file: string }) {
      const state = useOfficeDocument(file);
      capturedState = state;
      return React.createElement('div', null, state.pdfUrl || 'none');
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent, { file: 'https://example.com/guide.pdf' }));
    });

    expect(capturedState.isOffice).toBe(false);
    expect(capturedState.fileType).toBeNull();
    expect(capturedState.isConverting).toBe(false);
    expect(capturedState.pdfUrl).toBe('https://example.com/guide.pdf');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
