/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 10.0;

export const isSafariOrMobile = (): boolean =>
  typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
  );

export const MAX_CANVAS_DIM = 8192;
export const MAX_CANVAS_DIM_MOBILE = 4096;
export const MAX_CANVAS_PIXELS = 16777216; // 16.7 Megapixels (~64MB RGBA texture buffer)

/**
 * Calculates the next step when zooming in.
 * - Below 200%: steps by +25%
 * - 200% to 500%: steps by +50%
 * - 500% to 1000%: steps by +100%
 */
export function calculateNextZoomIn(currentScale: number, maxScale = MAX_SCALE): number {
  const step = currentScale < 2 ? 0.25 : currentScale < 5 ? 0.5 : 1.0;
  return Math.min(maxScale, Math.round((currentScale + step) * 100) / 100);
}

/**
 * Calculates the next step when zooming out.
 * - At or below 200%: steps by -25%
 * - 200% to 500%: steps by -50%
 * - Above 500%: steps by -100%
 */
export function calculateNextZoomOut(currentScale: number, minScale = MIN_SCALE): number {
  const step = currentScale <= 2 ? 0.25 : currentScale <= 5 ? 0.5 : 1.0;
  return Math.max(minScale, Math.round((currentScale - step) * 100) / 100);
}

/**
 * Clamps and rounds a requested zoom level within [minScale, maxScale].
 */
export function clampScale(scale: number, minScale = MIN_SCALE, maxScale = MAX_SCALE): number {
  return Math.min(maxScale, Math.max(minScale, Math.round(scale * 100) / 100));
}

/**
 * Calculates the safe rasterization scale for PDF.js viewport rendering so that
 * canvas dimensions and texture memory stay strictly within hardware limits.
 */
export function calculateSafeRenderScale(
  scale: number,
  outputScale: number,
  unscaledWidth: number,
  unscaledHeight: number,
  maxDim = isSafariOrMobile() ? MAX_CANVAS_DIM_MOBILE : MAX_CANVAS_DIM,
  maxPixels = MAX_CANVAS_PIXELS
): number {
  let renderScale = scale * outputScale;
  if (unscaledWidth * renderScale > maxDim) {
    renderScale = maxDim / unscaledWidth;
  }
  if (unscaledHeight * renderScale > maxDim) {
    renderScale = maxDim / unscaledHeight;
  }
  if ((unscaledWidth * renderScale) * (unscaledHeight * renderScale) > maxPixels) {
    renderScale = Math.sqrt(maxPixels / (unscaledWidth * unscaledHeight));
  }
  return renderScale;
}
