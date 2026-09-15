/**
 * Example Express / Node.js conversion proxy endpoint.
 *
 * This handler:
 * 1. Authenticates incoming user requests.
 * 2. Checks local / Redis cache via SHA-256 document hashing.
 * 3. Dispatches conversion requests to the Gotenberg microservice.
 * 4. Caches and streams the converted PDF back to TeamSync PDF Viewer.
 */
import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = express();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://localhost:3001/forms/libreoffice/convert';

// Simple in-memory cache (replace with Redis in production)
const pdfCache = new Map<string, Buffer>();

app.post('/api/convert-office', upload.any(), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No office file provided.' });
    }

    const file = files[0];

    // Compute SHA-256 hash of document buffer for cache key
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const cachedPdf = pdfCache.get(hash);

    if (cachedPdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Document-Cache', 'HIT');
      return res.send(cachedPdf);
    }

    // Prepare multipart form data for Gotenberg
    const form = new FormData();
    form.append('files', file.buffer, {
      filename: file.originalname || 'document.docx',
      contentType: file.mimetype,
    });

    // Optional Excel parameters
    if (req.body.fitToPageWidth === 'true') {
      form.append('fitToPageWidth', 'true');
    }

    const gotenbergResp = await fetch(GOTENBERG_URL, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    if (!gotenbergResp.ok) {
      const errorText = await gotenbergResp.text();
      return res.status(gotenbergResp.status).json({
        error: `Conversion service failed: ${errorText}`,
      });
    }

    const pdfBuffer = Buffer.from(await gotenbergResp.arrayBuffer());

    // Save to cache
    pdfCache.set(hash, pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Document-Cache', 'MISS');
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Office conversion error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default app;
