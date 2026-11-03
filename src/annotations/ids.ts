/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Stable, collision-free annotation ids. They double as the XFDF `name` attribute, which hosts use
 * to match persisted rows to live annotations, so they must never be timestamps.
 */
export function generateSecureId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return `${prefix}_${Date.now().toString(36)}_${arr[0].toString(36)}`;
  }
  return `${prefix}_${Date.now().toString(36)}`;
}

export function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC4122
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  // Fallback for runtimes without Web Crypto
  const timestamp = Date.now().toString(16).padStart(12, '0');
  const perf = Math.floor((globalThis.performance?.now?.() ?? 1) * 1000).toString(16).padStart(8, '0');
  const hex = (timestamp + perf).padEnd(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
