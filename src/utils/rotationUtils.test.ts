import { describe, expect, it } from 'vitest';
import { convertToRotated, convertToUnrotated, normalizeRotation } from './rotationUtils';

describe('rotationUtils', () => {
  it('normalizeRotation wraps into [0, 360)', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-360)).toBe(0);
  });

  it('rotated <-> unrotated point conversion round-trips', () => {
    const unW = 600;
    const unH = 800;
    for (const rotation of [0, 90, 180, 270, -90]) {
      const rot = convertToRotated(120, 340, rotation, unW, unH);
      const back = convertToUnrotated(rot.x, rot.y, rotation, unW, unH);
      expect(back.x).toBeCloseTo(120);
      expect(back.y).toBeCloseTo(340);
    }
  });
});
