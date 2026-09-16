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

// Converter credentials come ONLY from the deployment environment. A committed fallback
// value used to live here; it is a secret for a live service and never belongs in source.
// The env var is `Basic <base64(user:pass)>` (or any other Authorization value Gotenberg accepts).
const BASIC_AUTH = (globalThis as any).process?.env?.GOTENBERG_BASIC_AUTH as string | undefined;

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

  // Fail closed: without a converter credential this function must not forward anything.
  if (!BASIC_AUTH) {
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
      // Resolve target file URL
      let targetUrl = fileParam;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        const origin = reqUrl.origin;
        const cleanPath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
        targetUrl = `${origin}${cleanPath}`;
      }

      // Fetch the source office document
      const fileResp = await fetch(targetUrl);
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

      const fileBlob = await fileResp.blob();
      const cleanName =
        targetUrl.split('#')[0].split('?')[0].split('/').pop() || 'document.docx';

      // Forward to Gotenberg for conversion
      const formData = new FormData();
      formData.append('files', fileBlob, cleanName);

      const convResp = await fetch(RENDER_CONVERTER_URL, {
        method: 'POST',
        headers: {
          Authorization: BASIC_AUTH as string,
        },
        body: formData,
      });

      if (!convResp.ok) {
        const errText = await convResp.text();
        return new Response(
          JSON.stringify({
            error: 'Conversion failed',
            status: convResp.status,
            details: errText,
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
      const incomingFormData = await request.formData();

      // Ensure single 'files' entry for Gotenberg
      const outFormData = new FormData();
      let fileFound = false;

      for (const [key, value] of incomingFormData.entries()) {
        if (value instanceof Blob) {
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
          Authorization: BASIC_AUTH as string,
        },
        body: outFormData,
      });

      if (!convResp.ok) {
        const errDetail = await convResp.text();
        return new Response(
          JSON.stringify({
            error: 'Conversion service failed',
            status: convResp.status,
            details: errDetail,
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
