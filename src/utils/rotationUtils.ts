/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

/**
 * Converts screen/canvas coordinates in rotated page space to canonical unrotated page space.
 */
export function convertToUnrotated(rawX: number, rawY: number, rotation: number, unW: number, unH: number) {
  const normRot = ((rotation % 360) + 360) % 360;
  if (normRot === 90) {
    return { x: rawY, y: unH - rawX };
  }
  if (normRot === 180) {
    return { x: unW - rawX, y: unH - rawY };
  }
  if (normRot === 270) {
    return { x: unW - rawY, y: rawX };
  }
  return { x: rawX, y: rawY };
}

/**
 * Converts canonical unrotated page coordinates to rotated page space.
 */
export function convertToRotated(unX: number, unY: number, rotation: number, unW: number, unH: number) {
  const normRot = ((rotation % 360) + 360) % 360;
  if (normRot === 90) {
    return { x: unH - unY, y: unX };
  }
  if (normRot === 180) {
    return { x: unW - unX, y: unH - unY };
  }
  if (normRot === 270) {
    return { x: unY, y: unW - unX };
  }
  return { x: unX, y: unY };
}

/**
 * Converts a rectangle from unrotated page space to rotated page space.
 */
export function convertToRotatedRect(x: number, y: number, width: number, height: number, rotation: number, unW: number, unH: number) {
  const normRot = ((rotation % 360) + 360) % 360;
  if (normRot === 90) {
    return { x: unH - (y + height), y: x, width: height, height: width };
  }
  if (normRot === 180) {
    return { x: unW - (x + width), y: unH - (y + height), width, height };
  }
  if (normRot === 270) {
    return { x: y, y: unW - (x + width), width: height, height: width };
  }
  return { x, y, width, height };
}

/**
 * Returns SVG transform string for SVG groups to match page rotation.
 */
export function getRotationTransform(rotation: number, unW: number, unH: number): string | undefined {
  const normRot = ((rotation % 360) + 360) % 360;
  if (normRot === 90) return `translate(${unH}, 0) rotate(90)`;
  if (normRot === 180) return `translate(${unW}, ${unH}) rotate(180)`;
  if (normRot === 270) return `translate(0, ${unW}) rotate(270)`;
  return undefined;
}

/** Normalizes any degree value into [0, 360). */
export function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}
