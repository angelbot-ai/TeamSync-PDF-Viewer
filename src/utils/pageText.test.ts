import { describe, expect, it } from 'vitest';
import { buildPageText, collapseWhitespace, boundsForRawRange } from './pageText';

describe('pageText utility', () => {
  it('collapseWhitespace trims edges and collapses multiple spaces', () => {
    expect(collapseWhitespace('  hello   world\t\n ')).toBe('hello world');
    expect(collapseWhitespace('single')).toBe('single');
    expect(collapseWhitespace('   ')).toBe('');
  });

  it('buildPageText maintains equal map lengths and strict source mapping', () => {
    const items = [
      { str: 'Hello', hasEOL: false },
      { str: 'World', hasEOL: true },
      { str: 'Foo', hasEOL: false },
    ];
    const pt = buildPageText(items);

    expect(pt.fullText.length).toBe(pt.itemIndices.length);
    expect(pt.fullText.length).toBe(pt.charIndices.length);
    expect(pt.normText.length).toBe(pt.normToRaw.length);

    // Separator rule: hasEOL: false produces ' ', hasEOL: true produces '\n'
    expect(pt.fullText).toBe('Hello World\nFoo ');
    expect(pt.itemIndices[5]).toBe(-1); // separator after 'Hello'
    expect(pt.charIndices[5]).toBe(-1);
    expect(pt.itemIndices[11]).toBe(-1); // separator after 'World' (\n)
    expect(pt.charIndices[11]).toBe(-1);

    // normText has only single spaces
    expect(pt.normText).toBe('Hello World Foo ');
    expect(pt.normText.includes('  ')).toBe(false);

    // normToRaw is strictly increasing
    for (let i = 1; i < pt.normToRaw.length; i++) {
      expect(pt.normToRaw[i]).toBeGreaterThan(pt.normToRaw[i - 1]);
    }
  });

  it('folds consecutive whitespace runs including tabs, newlines, NBSP, and double spaces', () => {
    const items = [
      { str: 'Line1\t\u00A0  end', hasEOL: true }, // \t, NBSP, and double space inside item
      { str: 'Line2', hasEOL: false },
    ];
    const pt = buildPageText(items);

    // Raw text contains "Line1\t\u00A0  end\nLine2 "
    expect(pt.fullText).toContain('Line1\t\u00A0  end\nLine2');

    // In normText, the run "\t\u00A0  " should become a single ' '
    expect(pt.normText).toBe('Line1 end Line2 ');
    expect(pt.normText.includes('  ')).toBe(false);

    // Verify normToRaw maps the collapsed space to the first raw index of the whitespace run
    const normSpaceIdx = pt.normText.indexOf(' ');
    expect(normSpaceIdx).toBe(5);
    expect(pt.normToRaw[normSpaceIdx]).toBe(5); // first char of "\t\u00A0  " was index 5 in fullText
  });

  it('safely handles empty strings and marked-content items without str', () => {
    const items = [
      { str: '', hasEOL: false },
      { str: undefined as any, hasEOL: true }, // marked-content item without str property
      { str: 'Text', hasEOL: false },
    ];
    const pt = buildPageText(items);

    // Empty item contributes only one separator (' '), marked-content item contributes '\n'
    expect(pt.fullText).toBe(' \nText ');
    expect(pt.normText).toBe(' Text ');
    expect(pt.normText.length).toBe(pt.normToRaw.length);
  });

  it('boundsForRawRange calculates bounds within a single item', () => {
    const items = [
      { str: 'Hello World', transform: [10, 0, 0, 10, 50, 100], width: 110, height: 12, hasEOL: false },
    ];
    const pt = buildPageText(items);

    // 'World' starts at raw index 6 and ends at 11
    const bounds = boundsForRawRange(items, pt, 6, 11);
    expect(bounds).toHaveLength(1);
    // charWidth = 110 / 11 = 10; startX = 50 + 6 * 10 = 110; width = (10 - 6 + 1) * 10 = 50; y = 100; height = 12
    expect(bounds[0]).toEqual({
      x: 110,
      y: 100,
      width: 50,
      height: 12,
    });
  });

  it('boundsForRawRange calculates bounds across two items, skipping sentinels', () => {
    const items = [
      { str: 'First', transform: [10, 0, 0, 10, 20, 200], width: 50, height: 14, hasEOL: true }, // charWidth = 10
      { str: 'Second', transform: [10, 0, 0, 10, 20, 180], width: 60, height: 14, hasEOL: false }, // charWidth = 10
    ];
    const pt = buildPageText(items);
    // fullText is "First\nSecond " -> length 13
    // 'rst\nSec' spans 'First' indices 2..4, separator index 5 (-1 sentinel), 'Second' indices 6..8 (char 0..2)
    const bounds = boundsForRawRange(items, pt, 2, 9);
    expect(bounds).toHaveLength(2);

    // Item 0: 'rst' -> min: 2, max: 4. startX = 20 + 2 * 10 = 40. width = (4 - 2 + 1) * 10 = 30.
    expect(bounds[0]).toEqual({
      x: 40,
      y: 200,
      width: 30,
      height: 14,
    });

    // Item 1: 'Sec' -> min: 0, max: 2. startX = 20 + 0 * 10 = 20. width = (2 - 0 + 1) * 10 = 30.
    expect(bounds[1]).toEqual({
      x: 20,
      y: 180,
      width: 30,
      height: 14,
    });
  });
});
