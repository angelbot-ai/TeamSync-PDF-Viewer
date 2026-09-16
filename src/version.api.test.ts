/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import handler from '../api/version';

describe('api/version edge function', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles OPTIONS preflight request', async () => {
    const request = new Request('https://pdfviewer.teamsync.com/api/version', {
      method: 'OPTIONS',
    });
    const response = await handler(request);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns release info from GitHub API when available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tag_name: 'v1.7.1',
          name: 'Release 1.7.1',
          html_url: 'https://github.com/angelbot-ai/TeamSync-PDF-Viewer/releases/tag/v1.7.1',
          published_at: '2026-09-15T00:00:00Z',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const request = new Request('https://pdfviewer.teamsync.com/api/version');
    const response = await handler(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.version).toBe('1.7.1');
    expect(body.tag).toBe('v1.7.1');
    expect(body.releaseUrl).toBe('https://github.com/angelbot-ai/TeamSync-PDF-Viewer/releases/tag/v1.7.1');
  });

  it('falls back gracefully when GitHub API fails or rate-limits', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('GitHub rate limit'));

    const request = new Request('https://pdfviewer.teamsync.com/api/version');
    const response = await handler(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.version).toBe('1.7.1');
    expect(body.tag).toBe('v1.7.1');
    expect(body.releaseUrl).toContain('releases/tag/v1.7.1');
  });
});
