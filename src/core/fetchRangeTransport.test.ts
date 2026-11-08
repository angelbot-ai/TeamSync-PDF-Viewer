/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FetchRangeTransport, prepareDocumentLoading } from './fetchRangeTransport';
import * as pdfjsLib from 'pdfjs-dist';

describe('FetchRangeTransport (Item 7 Optimization)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('probes chunk 0 with Range: bytes=0-524287 and initializes FetchRangeTransport on 206 response', async () => {
    const fakeChunk0 = new Uint8Array(524288);
    fakeChunk0.fill(0x25); // %PDF

    const mockFetch = vi.fn().mockImplementation((url: string, init: any) => {
      const range = init.headers.get('Range');
      if (range === 'bytes=0-524287') {
        return Promise.resolve({
          status: 206,
          headers: new Headers({
            'Content-Range': 'bytes 0-524287/22904441',
            'Content-Type': 'application/pdf',
          }),
          arrayBuffer: () => Promise.resolve(fakeChunk0.buffer),
        });
      }
      return Promise.reject(new Error(`Unexpected range: ${range}`));
    });

    global.fetch = mockFetch;

    const prepared = await prepareDocumentLoading(
      'https://example.com/ongc-report.pdf',
      { rangeChunkSize: 524288, disableStream: true },
      { withCredentials: true, httpHeaders: { Authorization: 'Bearer token123' } }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('https://example.com/ongc-report.pdf');
    expect(calledInit.headers.get('Range')).toBe('bytes=0-524287');
    expect(calledInit.credentials).toBe('include');

    expect(prepared.docParams.range).toBeInstanceOf(pdfjsLib.PDFDataRangeTransport);
    expect(prepared.docParams.range.length).toBe(22904441);
    expect(prepared.docParams.url).toBe('https://example.com/ongc-report.pdf');
    expect(prepared.probeTelemetry).toEqual({
      bytesLoaded: 524288,
      totalBytes: 22904441,
      rangeRequests: 1,
    });
  });

  it('serves subsequent requestDataRange calls via fetch and invokes onDataRange', async () => {
    const fakeChunk0 = new Uint8Array(524288);
    const transport = new FetchRangeTransport(22904441, fakeChunk0, 'https://example.com/ongc-report.pdf', {
      withCredentials: true,
      httpHeaders: { 'X-Custom-Header': 'my-header' },
    });
    transport.transportReady(vi.fn());

    const onDataRangeSpy = vi.spyOn(transport, 'onDataRange');

    const fakeTrailer = new Uint8Array(65536);
    fakeTrailer.fill(0x0a);

    const mockFetch = vi.fn().mockImplementation((_url: string, init: any) => {
      const range = init.headers.get('Range');
      if (range === 'bytes=22838905-22904440') {
        return Promise.resolve({
          status: 206,
          arrayBuffer: () => Promise.resolve(fakeTrailer.buffer),
        });
      }
      return Promise.reject(new Error(`Unexpected range: ${range}`));
    });

    global.fetch = mockFetch;

    transport.requestDataRange(22838905, 22904441);

    await new Promise((r) => setTimeout(r, 20));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('https://example.com/ongc-report.pdf');
    expect(calledInit.headers.get('Range')).toBe('bytes=22838905-22904440');
    expect(calledInit.headers.get('X-Custom-Header')).toBe('my-header');
    expect(calledInit.credentials).toBe('include');

    expect(onDataRangeSpy).toHaveBeenCalledWith(22838905, expect.any(Uint8Array));
    expect(transport.rangeRequestCount).toBe(2);
  });

  it('opens directly with in-memory data when server responds with 200 OK (small file or no Range support)', async () => {
    const fullPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x31]); // %PDF1

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/pdf' }),
      arrayBuffer: () => Promise.resolve(fullPdfBytes.buffer),
    });

    global.fetch = mockFetch;

    const prepared = await prepareDocumentLoading(
      'https://example.com/small.pdf',
      { rangeChunkSize: 524288 }
    );

    expect(prepared.docParams.data).toBeInstanceOf(Uint8Array);
    expect(prepared.docParams.range).toBeUndefined();
    expect(prepared.docParams.data.byteLength).toBe(5);
    expect(prepared.probeTelemetry?.totalBytes).toBe(5);
  });

  it('gracefully falls back to standard { url } if initial range probe fails or returns 404/500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      headers: new Headers(),
    });

    global.fetch = mockFetch;

    const prepared = await prepareDocumentLoading(
      'https://example.com/server-error.pdf',
      { rangeChunkSize: 524288 }
    );

    expect(prepared.docParams.url).toBe('https://example.com/server-error.pdf');
    expect(prepared.docParams.range).toBeUndefined();
    expect(prepared.docParams.data).toBeUndefined();
  });

  it('bypasses range probe if disableRange is explicitly true', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const prepared = await prepareDocumentLoading(
      'https://example.com/no-range.pdf',
      { disableRange: true }
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(prepared.docParams.url).toBe('https://example.com/no-range.pdf');
    expect(prepared.docParams.disableRange).toBe(true);
  });

  it('aborts active fetch requests when abort() is called', async () => {
    const fakeChunk0 = new Uint8Array(100);
    const transport = new FetchRangeTransport(1000, fakeChunk0, 'https://example.com/cancel.pdf');

    let abortSignalObserved: AbortSignal | null = null;
    const mockFetch = vi.fn().mockImplementation((_url: string, init: any) => {
      abortSignalObserved = init.signal;
      return new Promise(() => {}); // never resolves
    });

    global.fetch = mockFetch;

    transport.requestDataRange(100, 200);
    expect(mockFetch).toHaveBeenCalled();
    expect(abortSignalObserved?.aborted).toBe(false);

    transport.abort();
    expect(abortSignalObserved?.aborted).toBe(true);
  });

  it('retries range fetch once on failure, then calls onError with status (Item 9)', async () => {
    const fakeChunk0 = new Uint8Array(100);
    const onError = vi.fn();
    const transport = new FetchRangeTransport(1000, fakeChunk0, 'https://example.com/retry.pdf', {
      onError,
    });

    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        status: 403,
        statusText: 'Forbidden',
      });
    });

    global.fetch = mockFetch;

    transport.requestDataRange(100, 200);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    const error = onError.mock.calls[0][0];
    expect(error.status).toBe(403);
    expect(error.message).toContain('403');
  });

  it('succeeds if retry attempt succeeds (Item 9)', async () => {
    const fakeChunk0 = new Uint8Array(100);
    const onError = vi.fn();
    const transport = new FetchRangeTransport(1000, fakeChunk0, 'https://example.com/retry-success.pdf', {
      onError,
    });
    const onDataRangeSpy = vi.spyOn(transport, 'onDataRange');

    let callCount = 0;
    const chunkData = new Uint8Array(100);
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        status: 206,
        arrayBuffer: () => Promise.resolve(chunkData.buffer),
      });
    });

    global.fetch = mockFetch;

    transport.requestDataRange(100, 200);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(onDataRangeSpy).toHaveBeenCalledWith(100, expect.any(Uint8Array));
      expect(onError).not.toHaveBeenCalled();
    });
  });

  it('rejects 200 response when begin > 0 (server ignored Range) (Item 10)', async () => {
    const fakeChunk0 = new Uint8Array(100);
    const onError = vi.fn();
    const transport = new FetchRangeTransport(1000, fakeChunk0, 'https://example.com/ignore-range.pdf', {
      onError,
    });

    const fullFile = new Uint8Array(1000);
    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        status: 200,
        arrayBuffer: () => Promise.resolve(fullFile.buffer),
      });
    });

    global.fetch = mockFetch;

    // Request range at offset 500
    transport.requestDataRange(500, 600);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
      expect(onError).toHaveBeenCalledTimes(1);
    });

    const error = onError.mock.calls[0][0];
    expect(error.status).toBe(200);
    expect(error.message).toContain('Server returned status 200');
  });

  it('cancels probe stream and aborts probe before fallback when 206 has no Content-Range (Item 11)', async () => {
    let cancelCalled = false;
    let abortObserved = false;

    const mockFetch = vi.fn().mockImplementation((_url: string, init: any) => {
      init.signal?.addEventListener('abort', () => {
        abortObserved = true;
      });
      return Promise.resolve({
        status: 206,
        headers: new Headers(), // No Content-Range header exposed!
        body: {
          cancel: () => {
            cancelCalled = true;
            return Promise.resolve();
          },
        },
      });
    });

    global.fetch = mockFetch;

    const prepared = await prepareDocumentLoading('https://example.com/no-content-range.pdf');

    expect(cancelCalled).toBe(true);
    expect(abortObserved).toBe(true);
    expect(prepared.docParams.url).toBe('https://example.com/no-content-range.pdf');
    expect(prepared.docParams.range).toBeUndefined();
  });
});
