/**
 * TeamSync Office Converter — Secure Auth Gateway & Reverse Proxy
 *
 * Enforces Authorization Bearer token or X-API-Key validation before forwarding
 * document conversion requests to the internal LibreOffice/Gotenberg engine.
 *
 * Zero external dependencies: runs on pure Node.js standard library with high-throughput
 * streaming pipes (req.pipe(proxyReq)).
 */

const http = require('http');

const PORT = parseInt(process.env.PORT || '3001', 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'secret-office-token';
const GOTENBERG_HOST = process.env.GOTENBERG_HOST || 'gotenberg';
const GOTENBERG_PORT = parseInt(process.env.GOTENBERG_PORT || '3000', 10);

const server = http.createServer((req, res) => {
  // Set standard CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-API-Key');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint (bypasses auth for container orchestrators & load balancers)
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', authEnforced: true }));
    return;
  }

  // Extract client authorization token
  const authHeader = req.headers['authorization'] || '';
  const apiKeyHeader = req.headers['x-api-key'] || '';

  let clientToken = '';
  if (authHeader.startsWith('Bearer ')) {
    clientToken = authHeader.slice(7).trim();
  } else if (authHeader) {
    clientToken = authHeader.trim();
  } else if (apiKeyHeader) {
    clientToken = String(apiKeyHeader).trim();
  }

  // Validate Token
  if (!clientToken || clientToken !== AUTH_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Unauthorized',
        message:
          'A valid Authorization Bearer token or X-API-Key header is required to convert documents.',
      })
    );
    return;
  }

  // Only allow POST requests for document conversion
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
    return;
  }

  // Forward request directly to Gotenberg via streaming pipe
  const proxyReq = http.request(
    {
      hostname: GOTENBERG_HOST,
      port: GOTENBERG_PORT,
      path: '/forms/libreoffice/convert',
      method: 'POST',
      headers: {
        ...req.headers,
        host: `${GOTENBERG_HOST}:${GOTENBERG_PORT}`,
      },
    },
    (proxyRes) => {
      // Forward response headers and status code back to client
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[TeamSync Auth Gateway] Error communicating with conversion engine:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Bad Gateway',
        message: 'Internal LibreOffice conversion engine is currently unavailable.',
      })
    );
  });

  // Stream client request body directly into Gotenberg
  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[TeamSync Auth Gateway] Running on http://0.0.0.0:${PORT}`);
  console.log(`[TeamSync Auth Gateway] Enforcing Authorization Bearer token`);
});
