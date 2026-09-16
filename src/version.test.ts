/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { VERSION } from './version';
import pkg from '../package.json';

describe('VERSION', () => {
  it('exports a valid semantic version string', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('matches package.json version in development/test environment', () => {
    expect(VERSION).toBe(pkg.version);
  });
});
