/**
 * TeamSync Office Converter — Edge Serverless Function (Vercel)
 *
 * Implements the Hybrid Office Architecture:
 * 1. GET ?file=<url>: Lazy backend pre-conversion with global CDN edge caching.
 *    Subsequent requests are served instantly (<50ms) from Vercel Edge cache.
 * 2. POST: Multipart file upload streaming for ad-hoc / drag-and-drop conversions.
 * 3. Security: Injects Gotenberg Basic Auth server-side so credentials never leak to clients.
 * 4. Cross-Origin: Emits full CORS headers to allow secure access across any domain.
 */

export const config = {
  runtime: 'edge',
};

const RENDER_CONVERTER_URL =
  'https://teamsync-office-converter-1.onrender.com/forms/libreoffice/convert';

export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Validates that a requested file URL is safe to fetch and not attempting
 * Server-Side Request Forgery (SSRF) against internal, loopback, or metadata services.
 */
export function isSafeTargetUrl(
  rawUrl: string,
  reqOrigin: string
): { safe: true; url: URL } | { safe: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, reqOrigin);
  } catch {
    return { safe: false, reason: 'Malformed URL' };
  }

  // Only allow HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}` };
  }

  // Port restrictions: reject internal service ports
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    return { safe: false, reason: `Disallowed port: ${parsed.port}` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Disallow loopback
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::]' ||
    hostname === '[::1]'
  ) {
    return { safe: false, reason: 'Loopback addresses are forbidden' };
  }

  // Disallow cloud metadata endpoints & link-local
  if (
    hostname === '169.254.169.254' ||
    hostname.startsWith('169.254.') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return { safe: false, reason: 'Cloud metadata and link-local addresses are forbidden' };
  }

  // Disallow private IPv4 subnets (RFC 1918 & reserved)
  if (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
  ) {
    return { safe: false, reason: 'Private IP subnets are forbidden' };
  }

  // Disallow IPv6 private / link-local / unique-local
  if (
    hostname.startsWith('[fe80:') ||
    hostname.startsWith('[fc') ||
    hostname.startsWith('[fd') ||
    hostname === '[0:0:0:0:0:0:0:1]'
  ) {
    return { safe: false, reason: 'Private IPv6 addresses are forbidden' };
  }

  // Disallow internal domain suffixes
  if (
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.lan')
  ) {
    return { safe: false, reason: 'Internal domain names are forbidden' };
  }

  return { safe: true, url: parsed };
}

// Converter credentials come from the deployment environment (GOTENBERG_BASIC_AUTH)
// or optionally the Authorization header from the caller.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export default async function handler(request: Request): Promise<Response> {
  // 1. Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // Converter credentials from environment or client authorization header
  const basicAuth =
    ((globalThis as any).process?.env?.GOTENBERG_BASIC_AUTH as string | undefined) ||
    request.headers.get('Authorization') ||
    undefined;

  // Fail closed: without a converter credential this function must not forward anything.
  if (!basicAuth) {
    return new Response(
      JSON.stringify({ error: 'Converter not configured', message: 'GOTENBERG_BASIC_AUTH is not set' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // 2. GET: Lazy backend pre-conversion with CDN Edge Caching
  if (request.method === 'GET') {
    const reqUrl = new URL(request.url);
    const fileParam = reqUrl.searchParams.get('file') || reqUrl.searchParams.get('doc');

    if (!fileParam) {
      return new Response(
        JSON.stringify({
          error: 'Missing file parameter',
          message: 'Provide a document path or URL via ?file=<path_or_url>',
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      // SEC-01: Validate target URL against SSRF and internal network scanning
      const validation = isSafeTargetUrl(fileParam, reqUrl.origin);
      if (!validation.safe) {
        return new Response(
          JSON.stringify({
            error: 'Forbidden target URL',
            message: `Target URL is not permitted: ${validation.reason}`,
          }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      const targetUrl = validation.url.toString();

      // Fetch the source office document with manual redirect handling to prevent redirect SSRF
      const fileResp = await fetch(targetUrl, { redirect: 'manual' });
      if (fileResp.status >= 300 && fileResp.status < 400) {
        return new Response(
          JSON.stringify({
            error: 'Redirects not permitted',
            message: 'Target URL resulted in an HTTP redirect. Provide the direct document URL for security.',
          }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!fileResp.ok) {
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch source document',
            status: fileResp.status,
            targetUrl,
          }),
          {
            status: 404,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      // SEC-02: Check content-length header before buffering
      const contentLengthHeader = fileResp.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > MAX_DOCUMENT_SIZE) {
          return new Response(
            JSON.stringify({
              error: 'Payload Too Large',
              message: `Source document exceeds maximum allowed size of 25MB (${contentLength} bytes)`,
            }),
            {
              status: 413,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      const fileBlob = await fileResp.blob();
      if (fileBlob.size > MAX_DOCUMENT_SIZE) {
        return new Response(
          JSON.stringify({
            error: 'Payload Too Large',
            message: `Source document exceeds maximum allowed size of 25MB (${fileBlob.size} bytes)`,
          }),
          {
            status: 413,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      const cleanName =
        targetUrl.split('#')[0].split('?')[0].split('/').pop() || 'document.docx';

      // Forward to Gotenberg for conversion
      const formData = new FormData();
      formData.append('files', fileBlob, cleanName);

      const convResp = await fetch(RENDER_CONVERTER_URL, {
        method: 'POST',
        headers: {
          Authorization: basicAuth,
        },
        body: formData,
      });

      if (!convResp.ok) {
        const errText = await convResp.text();
        console.error('[convert-edge] GET conversion failed:', convResp.status, errText);
        return new Response(
          JSON.stringify({
            error: 'Conversion failed',
            status: convResp.status,
            message: 'The conversion microservice was unable to process the document.',
          }),
          {
            status: convResp.status,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      const pdfBytes = await convResp.arrayBuffer();

      // Return PDF with long-lived Edge & CDN cache headers
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${cleanName.replace(/\.[^/.]+$/, '')}.pdf"`,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: err?.message || 'Unknown error occurred',
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // 3. POST: On-the-fly multipart file conversion
  if (request.method === 'POST') {
    try {
      // SEC-02: Enforce payload size limit prior to parsing form data
      const reqContentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (reqContentLength > MAX_DOCUMENT_SIZE) {
        return new Response(
          JSON.stringify({
            error: 'Payload Too Large',
            message: `Uploaded payload exceeds maximum allowed size of 25MB (${reqContentLength} bytes)`,
          }),
          {
            status: 413,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      const incomingFormData = await request.formData();

      // Ensure single 'files' entry for Gotenberg
      const outFormData = new FormData();
      let fileFound = false;

      for (const [key, value] of incomingFormData.entries()) {
        if (value instanceof Blob) {
          if (value.size > MAX_DOCUMENT_SIZE) {
            return new Response(
              JSON.stringify({
                error: 'Payload Too Large',
                message: `Uploaded file exceeds maximum allowed size of 25MB (${value.size} bytes)`,
              }),
              {
                status: 413,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              }
            );
          }

          if (!fileFound) {
            let fileName = (value as File).name || 'document.docx';
            if (!fileName.includes('.') || fileName === 'blob' || fileName === 'convert') {
              const mime = value.type;
              const base = fileName.replace(/\.[^/.]+$/, '');
              if (mime.includes('sheet') || mime.includes('excel') || mime.includes('xlsx')) {
                fileName = `${base}.xlsx`;
              } else if (mime.includes('presentation') || mime.includes('powerpoint') || mime.includes('pptx')) {
                fileName = `${base}.pptx`;
              } else {
                fileName = `${base}.docx`;
              }
            }
            outFormData.append('files', value, fileName);
            fileFound = true;
          }
        } else {
          // Pass through options like fitToPageWidth or includeGridlines
          outFormData.append(key, value);
        }
      }

      if (!fileFound) {
        return new Response(
          JSON.stringify({
            error: 'No file uploaded',
            message: "Please include a file under field name 'files' or 'file'.",
          }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      const convResp = await fetch(RENDER_CONVERTER_URL, {
        method: 'POST',
        headers: {
          Authorization: basicAuth,
        },
        body: outFormData,
      });

      if (!convResp.ok) {
        const errDetail = await convResp.text();
        console.error('[convert-edge] POST conversion failed:', convResp.status, errDetail);
        return new Response(
          JSON.stringify({
            error: 'Conversion service failed',
            status: convResp.status,
            message: 'The conversion microservice was unable to process the uploaded file.',
          }),
          {
            status: convResp.status,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      const pdfBytes = await convResp.arrayBuffer();

      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/pdf',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: 'Error processing upload',
          message: err?.message || 'Unknown error occurred',
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
