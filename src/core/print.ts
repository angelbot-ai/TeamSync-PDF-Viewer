/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Printing: the exported document (annotations / redactions / watermark baked in) is loaded into a
 * hidden iframe and printed through the browser's PDF viewer. Falls back to opening the PDF in a
 * new tab when the frame cannot print (e.g. the browser has no inline PDF viewer).
 */
export interface PrintOptions {
  title?: string;
  /** How long the hidden frame is kept alive for the print dialog (default 60s). */
  timeoutMs?: number;
}

export async function printPdfBytes(bytes: Uint8Array, opts: PrintOptions = {}): Promise<void> {
  if (typeof document === 'undefined') throw new Error('[teamsync-pdf-viewer] printing needs a browser');
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  iframe.title = opts.title ?? 'Print';
  iframe.setAttribute('aria-hidden', 'true');

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      iframe.remove();
      URL.revokeObjectURL(url);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      setTimeout(cleanup, opts.timeoutMs ?? 60000);
      resolve();
    };
    iframe.onload = () => {
      try {
        const w = iframe.contentWindow;
        if (!w) throw new Error('no frame window');
        w.focus();
        w.print();
      } catch {
        // No inline PDF viewer (or it refused): let the user print from a new tab instead.
        window.open(url, '_blank', 'noopener');
      }
      finish();
    };
    iframe.onerror = () => {
      cleanup();
      if (!settled) {
        settled = true;
        reject(new Error('[teamsync-pdf-viewer] print frame failed to load'));
      }
    };
    document.body.appendChild(iframe);
    iframe.src = url;
  });
}
