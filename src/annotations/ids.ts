/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Stable, collision-free annotation ids. They double as the XFDF `name` attribute, which hosts use
 * to match persisted rows to live annotations, so they must never be timestamps.
 */
export function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old runtimes: 128 bits from Math.random, formatted like a UUID v4.
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
