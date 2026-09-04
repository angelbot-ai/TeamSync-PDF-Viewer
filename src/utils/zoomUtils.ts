/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8.0;

export const isMobileOrTablet = (): boolean =>
  typeof navigator !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
    (/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
  );

export const isSafariOrMobile = isMobileOrTablet;

export const MAX_CANVAS_DIM = 4096;
export const MAX_CANVAS_DIM_MOBILE = 2048;
export const MAX_CANVAS_PIXELS = 8388608; // 8.4 Megapixels (~32MB RGBA texture buffer)
export const MAX_CANVAS_PIXELS_MOBILE = 4194304; // 4.2 Megapixels (~16MB RGBA texture buffer)

/**
 * Calculates the next step when zooming in.
 * - Below 200%: steps by +25%
 * - 200% to 500%: steps by +50%
 * - 500% to 800%: steps by +100%
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
  maxDim = isMobileOrTablet() ? MAX_CANVAS_DIM_MOBILE : MAX_CANVAS_DIM,
  maxPixels = isMobileOrTablet() ? MAX_CANVAS_PIXELS_MOBILE : MAX_CANVAS_PIXELS
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

export interface ScrollCompensationParams {
  prevScale: number;
  newScale: number;
  containerWidth: number;
  containerHeight: number;
  currentScrollLeft: number;
  currentScrollTop: number;
  basePageWidth: number;
  focusPoint?: { vx: number | null; vy: number | null } | null;
  isProgrammatic?: boolean;
}

export interface ScrollPosition {
  scrollLeft: number;
  scrollTop: number;
}

/**
 * Calculates compensating scroll offsets during scale changes.
 * Prevents view jumping or pushing page 1 down on initial fit or programmatic fit.
 */
export function calculateScrollCompensation(params: ScrollCompensationParams): ScrollPosition {
  const {
    prevScale,
    newScale,
    containerWidth: cW,
    containerHeight: cH,
    currentScrollLeft,
    currentScrollTop,
    basePageWidth: baseW,
    focusPoint,
    isProgrammatic = false,
  } = params;

  // On programmatic fit (e.g. fit-width, fit-page, initial document fit),
  // do not run user-driven center-zoom compensation.
  if (isProgrammatic) {
    return {
      scrollLeft: 0,
      scrollTop: currentScrollTop <= 1 ? 0 : currentScrollTop,
    };
  }

  const hasFocusPoint = focusPoint?.vx != null && focusPoint?.vy != null;

  // If user is at the top of the document (scrollTop <= 0) and no explicit focus point was set:
  // Keep the top of the page pinned to the top rather than pushing it down into negative space.
  if (!hasFocusPoint && currentScrollTop <= 0) {
    return {
      scrollLeft: 0,
      scrollTop: 0,
    };
  }

  const vx = hasFocusPoint ? focusPoint!.vx! : cW / 2;
  const vy = hasFocusPoint ? focusPoint!.vy! : cH / 2;

  const x = vx + currentScrollLeft;
  const y = vy + currentScrollTop;

  const pLeft1 = Math.max(0, cW / 2 - (baseW * prevScale) / 2);
  const pLeft2 = Math.max(0, cW / 2 - (baseW * newScale) / 2);

  const pageX = x - pLeft1;
  const newPageX = pageX * (newScale / prevScale);
  const newX = pLeft2 + newPageX;

  return {
    scrollLeft: Math.max(0, newX - vx),
    scrollTop: Math.max(0, (y * (newScale / prevScale)) - vy),
  };
}

