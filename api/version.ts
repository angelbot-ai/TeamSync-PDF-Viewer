/**
 * TeamSync PDF Viewer — Version & Release API (Vercel Edge Function)
 *
 * Automatically queries and caches the latest GitHub release for
 * angelbot-ai/TeamSync-PDF-Viewer. Provides zero-latency, rate-limit-free
 * version checks for client applications and the About dialog.
 */

export const config = {
  runtime: 'edge',
};

const FALLBACK_VERSION = '1.8.1';
const REPO_OWNER = 'angelbot-ai';
const REPO_NAME = 'TeamSync-PDF-Viewer';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const fallbackData = {
    version: FALLBACK_VERSION,
    tag: `v${FALLBACK_VERSION}`,
    name: `TeamSync PDF Viewer v${FALLBACK_VERSION}`,
    releaseUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${FALLBACK_VERSION}`,
  };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      {
        headers: {
          'User-Agent': 'TeamSync-PDF-Viewer',
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const version = data.tag_name ? data.tag_name.replace(/^v/, '') : FALLBACK_VERSION;
      return new Response(
        JSON.stringify({
          version,
          tag: data.tag_name || `v${version}`,
          name: data.name || `v${version}`,
          releaseUrl: data.html_url || fallbackData.releaseUrl,
          publishedAt: data.published_at,
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          },
        }
      );
    }
  } catch {
    // Return fallback silently on any network or rate-limit issue
  }

  return new Response(JSON.stringify(fallbackData), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
