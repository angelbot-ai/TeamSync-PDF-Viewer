/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 *
 * Direct HTTP Range Transport for PDF.js (Item 7 Optimization).
 * Bypasses the initial full-file HTTP 200 GET request and its HTTP/2 connection drain
 * by fetching chunk 0 directly with `Range: bytes=0-${chunkSize - 1}` and serving
 * subsequent PDF.js range reads via PDFDataRangeTransport.
 */

import * as pdfjsLib from 'pdfjs-dist';

export interface RangeTransportFetchOptions {
  withCredentials?: boolean;
  httpHeaders?: Record<string, string>;
  rangeChunkSize?: number;
  disableRange?: boolean;
  disableStream?: boolean;
  signal?: AbortSignal;
  onProgress?: (info: { bytesLoaded: number; totalBytes: number; rangeRequests: number }) => void;
  onRangeRequest?: () => void;
  onError?: (error: Error & { status?: number }) => void;
}

const BaseDataRangeTransport = (pdfjsLib.PDFDataRangeTransport || class {
  length: number;
  initialData: Uint8Array | null;
  progressiveDone?: boolean;
  contentDispositionFilename?: string;
  constructor(length: number, initialData: Uint8Array | null, progressiveDone?: boolean, contentDispositionFilename?: string) {
    this.length = length;
    this.initialData = initialData;
    this.progressiveDone = progressiveDone;
    this.contentDispositionFilename = contentDispositionFilename;
  }
  onDataRange(_begin: number, _chunk: Uint8Array | null): void {}
  onDataProgressiveRead(_chunk: Uint8Array | null): void {}
  onDataProgressiveDone(): void {}
  transportReady(_listener: any): void {}
  requestDataRange(_begin: number, _end: number): void {}
  abort(): void {}
}) as typeof pdfjsLib.PDFDataRangeTransport;

export class FetchRangeTransport extends BaseDataRangeTransport {
  private abortControllers = new Set<AbortController>();
  private isAborted = false;
  private totalRangeRequests = 1; // Chunk 0 was request #1
  private totalBytesLoaded: number;
  private url: string;
  private options: RangeTransportFetchOptions;

  constructor(
    length: number,
    initialData: Uint8Array,
    url: string,
    options: RangeTransportFetchOptions = {}
  ) {
    super(length, initialData);
    this.url = url;
    this.options = options;
    this.totalBytesLoaded = initialData.byteLength;
  }

  public get rangeRequestCount(): number {
    return this.totalRangeRequests;
  }

  public get loadedBytes(): number {
    return this.totalBytesLoaded;
  }

  override requestDataRange(begin: number, end: number): void {
    if (this.isAborted) return;
    this.totalRangeRequests++;
    this.options.onRangeRequest?.();

    const doFetchRange = async (attempt: number): Promise<void> => {
      if (this.isAborted) return;
      const ac = new AbortController();
      this.abortControllers.add(ac);

      const headers = new Headers(this.options.httpHeaders || {});
      // PDF.js end is exclusive; HTTP Range is inclusive
      headers.set('Range', `bytes=${begin}-${Math.max(begin, end - 1)}`);

      try {
        const res = await fetch(this.url, {
          method: 'GET',
          headers,
          credentials: this.options.withCredentials ? 'include' : 'same-origin',
          signal: ac.signal
        });

        this.abortControllers.delete(ac);
        if (this.isAborted) return;

        if (res.status === 206) {
          const buffer = await res.arrayBuffer();
          if (this.isAborted) return;
          const chunk = new Uint8Array(buffer);
          this.totalBytesLoaded += chunk.byteLength;
          this.options.onProgress?.({
            bytesLoaded: this.totalBytesLoaded,
            totalBytes: this.length,
            rangeRequests: this.totalRangeRequests
          });
          try {
            this.onDataRange(begin, chunk);
          } catch {}
          return;
        }

        if (res.status === 200) {
          const buffer = await res.arrayBuffer();
          if (this.isAborted) return;
          const chunk = new Uint8Array(buffer);
          // Accept 200 only for begin === 0 with byteLength === length (Item 10)
          if (begin === 0 && chunk.byteLength === this.length) {
            this.totalBytesLoaded += chunk.byteLength;
            this.options.onProgress?.({
              bytesLoaded: this.totalBytesLoaded,
              totalBytes: this.length,
              rangeRequests: this.totalRangeRequests
            });
            try {
              this.onDataRange(begin, chunk);
            } catch {}
            return;
          }
          // Server ignored Range on a later read or length mismatched: treat as failure
          throw Object.assign(
            new Error(`Server returned status 200 for range ${begin}-${end - 1} on "${this.url}" (expected partial content)`),
            { status: 200, name: 'ResponseException' }
          );
        }

        if (res.status === 416) {
          // Range Not Satisfiable (e.g. read at or past EOF)
          try {
            this.onDataRange(begin, new Uint8Array(0));
          } catch {}
          return;
        }

        // 403, 5xx, or unexpected HTTP status
        throw Object.assign(
          new Error(`Unexpected server response (${res.status}) while retrieving PDF range "${this.url}".`),
          { status: res.status, name: 'ResponseException' }
        );
      } catch (err: any) {
        this.abortControllers.delete(ac);
        if (err?.name === 'AbortError' || this.isAborted) {
          return;
        }

        // Retry once on failure (Item 9)
        if (attempt === 0) {
          console.warn(`[teamsync-pdf-viewer] HTTP range fetch ${begin}-${end - 1} failed, retrying once:`, err?.message || err);
          return doFetchRange(1);
        }

        // Second attempt failed: fail the load with error carrying status
        console.error(`[teamsync-pdf-viewer] HTTP range fetch ${begin}-${end - 1} failed permanently:`, err?.message || err);
        const finalError = err instanceof Error
          ? err
          : Object.assign(new Error(`Failed to load PDF range "${this.url}": ${String(err)}`), { status: err?.status || 0, name: 'ResponseException' });
        if (!(finalError as any).status && err?.status) {
          (finalError as any).status = err.status;
        }
        if (!(finalError as any).name) {
          (finalError as any).name = 'ResponseException';
        }

        this.abort();
        this.options.onError?.(finalError);
      }
    };

    doFetchRange(0);
  }

  override abort(): void {
    this.isAborted = true;
    for (const ac of this.abortControllers) {
      try { ac.abort(); } catch {}
    }
    this.abortControllers.clear();
  }
}

export interface PreparedDocSource {
  docParams: any;
  transport?: FetchRangeTransport;
  abort?: () => void;
  probeTelemetry?: { bytesLoaded: number; totalBytes: number; rangeRequests: number };
}

/**
 * Prepares PDF.js document parameters by probing chunk 0 with an HTTP Range request.
 * - If server returns 206: initializes FetchRangeTransport with Content-Range length & chunk 0.
 * - If server returns 200: opens directly with in-memory full data.
 * - If probe fails or unsupported: falls back to standard { url }.
 */
export async function prepareDocumentLoading(
  url: string,
  networkParams: Record<string, any> = {},
  options: RangeTransportFetchOptions = {}
): Promise<PreparedDocSource> {
  const chunkSize = networkParams.rangeChunkSize || 512 * 1024;
  const isHttpUrl = typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));

  if (!isHttpUrl || networkParams.disableRange || typeof fetch === 'undefined') {
    return { docParams: { url, ...networkParams } };
  }

  const probeController = new AbortController();
  const linkedSignal = options.signal;
  if (linkedSignal) {
    if (linkedSignal.aborted) {
      probeController.abort();
    } else {
      linkedSignal.addEventListener('abort', () => probeController.abort(), { once: true });
    }
  }

  try {
    const headers = new Headers(networkParams.httpHeaders || options.httpHeaders || {});
    headers.set('Range', `bytes=0-${chunkSize - 1}`);

    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: options.withCredentials ? 'include' : 'same-origin',
      signal: probeController.signal
    });

    if (res.status === 206) {
      const contentRange = res.headers.get('Content-Range') || '';
      const match = /\/(\d+)$/.exec(contentRange);
      if (match) {
        const totalLength = parseInt(match[1], 10);
        if (totalLength > 0) {
          const buf = await res.arrayBuffer();
          const initialChunk = new Uint8Array(buf);
          const transport = new FetchRangeTransport(totalLength, initialChunk, url, {
            ...options,
            httpHeaders: networkParams.httpHeaders || options.httpHeaders,
            withCredentials: options.withCredentials
          });

          const probeTelemetry = {
            bytesLoaded: initialChunk.byteLength,
            totalBytes: totalLength,
            rangeRequests: 1
          };

          return {
            docParams: {
              url,
              range: transport,
              ...networkParams
            },
            transport,
            abort: () => transport.abort(),
            probeTelemetry
          };
        }
      }
      // Content-Range missing or unreadable (e.g. not exposed cross-origin):
      // Abort probe before falling back so the 512 KB chunk isn't downloaded for nothing (Item 11)
      try { (res as any).body?.cancel?.()?.catch?.(() => {}); } catch {}
      probeController.abort();
      return { docParams: { url, ...networkParams } };
    } else if (res.status === 200) {
      // Small file or server doesn't support Range requests - full data already returned
      const buf = await res.arrayBuffer();
      const data = new Uint8Array(buf);
      return {
        docParams: {
          url,
          data,
          ...networkParams
        },
        probeTelemetry: {
          bytesLoaded: data.byteLength,
          totalBytes: data.byteLength,
          rangeRequests: 1
        }
      };
    } else {
      // Non-200, non-206 response on probe: abort probe before falling back
      try { (res as any).body?.cancel?.()?.catch?.(() => {}); } catch {}
      probeController.abort();
      return { docParams: { url, ...networkParams } };
    }
  } catch (err: any) {
    if (options.signal?.aborted) {
      throw err;
    }
    // Fall back to standard { url } loading on fetch/CORS errors
  }

  return { docParams: { url, ...networkParams } };
}
