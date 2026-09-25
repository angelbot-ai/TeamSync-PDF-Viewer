/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import handler, { isSafeTargetUrl, MAX_DOCUMENT_SIZE } from '../api/convert';

describe('api/convert edge function security', () => {
  const originalEnvAuth = process.env.GOTENBERG_BASIC_AUTH;

  beforeEach(() => {
    process.env.GOTENBERG_BASIC_AUTH = 'Basic dGVzdDp0ZXN0';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnvAuth !== undefined) {
      process.env.GOTENBERG_BASIC_AUTH = originalEnvAuth;
    } else {
      delete process.env.GOTENBERG_BASIC_AUTH;
    }
  });

  describe('isSafeTargetUrl (SEC-01 SSRF Defenses)', () => {
    const origin = 'https://pdfviewer.teamsync.com';

    it('permits relative paths resolved against host origin', () => {
      const res = isSafeTargetUrl('/sample.docx', origin);
      expect(res.safe).toBe(true);
      if (res.safe) {
        expect(res.url.toString()).toBe('https://pdfviewer.teamsync.com/sample.docx');
      }
    });

    it('permits valid external public HTTPS URLs', () => {
      const res = isSafeTargetUrl('https://cdn.example.com/reports/document.docx', origin);
      expect(res.safe).toBe(true);
      if (res.safe) {
        expect(res.url.toString()).toBe('https://cdn.example.com/reports/document.docx');
      }
    });

    it('blocks loopback IP addresses and localhost', () => {
      expect(isSafeTargetUrl('http://127.0.0.1/secret.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://localhost/secret.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://[::1]/secret.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://0.0.0.0/secret.docx', origin).safe).toBe(false);
    });

    it('blocks cloud metadata endpoints and link-local addresses', () => {
      expect(isSafeTargetUrl('http://169.254.169.254/latest/meta-data/', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://169.254.1.1/internal.doc', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://metadata.google.internal/computeMetadata/v1/', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://instance-data/latest/meta-data/', origin).safe).toBe(false);
    });

    it('blocks RFC1918 private IPv4 subnets', () => {
      expect(isSafeTargetUrl('http://10.0.0.1/finance.xlsx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://172.16.5.2/confidential.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://172.31.255.255/doc.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://192.168.1.100/admin.pptx', origin).safe).toBe(false);
    });

    it('blocks IPv6-mapped IPv4 addresses and IPv4-compatible IPv6', () => {
      expect(isSafeTargetUrl('http://[::ffff:127.0.0.1]/doc.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://[::ffff:169.254.169.254]/doc.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://[::ffff:10.0.0.1]/doc.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://[::127.0.0.1]/doc.docx', origin).safe).toBe(false);
    });

    it('blocks Carrier-Grade NAT and cloud VPC private space', () => {
      expect(isSafeTargetUrl('http://100.64.0.1/doc.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://100.100.100.200/doc.docx', origin).safe).toBe(false);
    });

    it('blocks DNS rebinding domain services', () => {
      expect(isSafeTargetUrl('http://127.0.0.1.nip.io/doc.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://localtest.me/doc.docx', origin).safe).toBe(false);
    });

    it('blocks non-HTTP/HTTPS protocols', () => {
      expect(isSafeTargetUrl('file:///etc/passwd', origin).safe).toBe(false);
      expect(isSafeTargetUrl('ftp://internal.server/doc.docx', origin).safe).toBe(false);
      expect(isSafeTargetUrl('gopher://internal.server/doc.docx', origin).safe).toBe(false);
    });

    it('blocks internal ports to avoid port scanning', () => {
      expect(isSafeTargetUrl('http://example.com:6379/dump.rdb', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://example.com:22/banner', origin).safe).toBe(false);
      expect(isSafeTargetUrl('http://example.com:27017/test', origin).safe).toBe(false);
    });

    it('enforces supported Office document extensions', () => {
      expect(isSafeTargetUrl('https://cdn.example.com/file.html', origin).safe).toBe(false);
      expect(isSafeTargetUrl('https://cdn.example.com/api/data.json', origin).safe).toBe(false);
      expect(isSafeTargetUrl('https://cdn.example.com/executable.exe', origin).safe).toBe(false);
      expect(isSafeTargetUrl('https://cdn.example.com/file.docx', origin).safe).toBe(true);
      expect(isSafeTargetUrl('https://cdn.example.com/sheet.xlsx', origin).safe).toBe(true);
      expect(isSafeTargetUrl('https://cdn.example.com/slides.pptx', origin).safe).toBe(true);
      expect(isSafeTargetUrl('https://cdn.example.com/data.csv', origin).safe).toBe(true);
    });
  });

  describe('handler integration', () => {
    it('handles OPTIONS preflight request', async () => {
      const request = new Request('https://pdfviewer.teamsync.com/api/convert', {
        method: 'OPTIONS',
      });
      const response = await handler(request);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('rejects SSRF attempts in GET request with 400 Bad Request', async () => {
      const request = new Request('https://pdfviewer.teamsync.com/api/convert?file=http://169.254.169.254/secret');
      const response = await handler(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBe('Forbidden target URL');
      expect(json.message).toContain('Cloud metadata and link-local addresses are forbidden');
    });

    it('rejects POST upload exceeding 25MB with 413 Payload Too Large', async () => {
      const oversized = MAX_DOCUMENT_SIZE + 1024;
      const request = new Request('https://pdfviewer.teamsync.com/api/convert', {
        method: 'POST',
        headers: {
          'Content-Length': String(oversized),
          'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary123',
        },
      });

      const response = await handler(request);
      expect(response.status).toBe(413);
      const json = await response.json();
      expect(json.error).toBe('Payload Too Large');
    });

    it('rejects GET file fetch if content-length exceeds 25MB with 413', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(new Uint8Array(100), {
          status: 200,
          headers: {
            'Content-Length': String(MAX_DOCUMENT_SIZE + 1000),
          },
        })
      );

      const request = new Request('https://pdfviewer.teamsync.com/api/convert?file=https://cdn.example.com/big.docx');
      const response = await handler(request);
      expect(response.status).toBe(413);
      const json = await response.json();
      expect(json.error).toBe('Payload Too Large');
    });

    it('rejects HTTP redirects (301/302) to prevent second-order SSRF', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            Location: 'http://169.254.169.254/latest/meta-data/',
          },
        })
      );

      const request = new Request('https://pdfviewer.teamsync.com/api/convert?file=https://cdn.example.com/redirect.docx');
      const response = await handler(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBe('Redirects not permitted');
      expect(json.message).toContain('HTTP redirect');
    });

    it('sanitizes upstream converter error messages and prevents path leakage', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'Content-Length': '3' },
          })
        )
        .mockResolvedValueOnce(
          new Response('LibreOffice internal error: /tmp/gotenberg-38491/doc.docx failed', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
          })
        );

      const request = new Request('https://pdfviewer.teamsync.com/api/convert?file=https://cdn.example.com/doc.docx');
      const response = await handler(request);
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.error).toBe('Conversion failed');
      expect(json.message).toBe('The conversion microservice was unable to process the document.');
      expect(json.details).toBeUndefined();
    });

    it('rejects upstream file fetch when Content-Type is disallowed (e.g. text/html)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('<html><body>Fake Doc</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      );

      const request = new Request('https://pdfviewer.teamsync.com/api/convert?file=https://cdn.example.com/fake.docx');
      const response = await handler(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBe('Invalid content type');
      expect(json.message).toContain('text/html');
    });
  });
});
