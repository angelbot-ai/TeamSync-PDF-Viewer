/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, expect, it, vi } from 'vitest';
import { searchPdfText } from './usePdfSearch';

function createMockPdf(pages: { items: any[]; viewport?: { width: number; height: number } }[]) {
  const pageMocks = pages.map(p => ({
    getTextContent: vi.fn().mockResolvedValue({ items: p.items }),
    getViewport: vi.fn().mockReturnValue(p.viewport ?? { width: 612, height: 792 }),
    cleanup: vi.fn(),
  }));

  return {
    numPages: pages.length,
    getPage: vi.fn((pageNum: number) => {
      const page = pageMocks[pageNum - 1];
      if (!page) return Promise.reject(new Error(`Page ${pageNum} not found`));
      return Promise.resolve(page);
    }),
    _pageMocks: pageMocks,
  };
}

describe('searchPdfText', () => {
  const page1Items = [
    {
      str: 'Hello World',
      transform: [10, 0, 0, 10, 50, 100],
      width: 110,
      height: 12,
      hasEOL: false,
    },
  ];

  const page2Items = [
    {
      str: 'Payment terms: all invoices shall be settled within ', // length 52
      transform: [10, 0, 0, 10, 50, 220],
      width: 520,
      height: 12,
      hasEOL: true, // raw index 52 is '\n'; next item starts at raw index 53
    },
    {
      str: 'net thirty days from the date of a valid invoice.', // length 49 (indices 53..101)
      transform: [10, 0, 0, 10, 50, 200],
      width: 490,
      height: 12,
      hasEOL: true, // raw index 102 is '\n'; next item starts at raw index 103
    },
    {
      str: 'Late payments are subject to a 1.5% monthly finance charge and the', // length 66 (indices 103..168)
      transform: [10, 0, 0, 10, 50, 180],
      width: 660,
      height: 12,
      hasEOL: true, // raw index 169 is '\n'; next item starts at raw index 170
    },
    {
      str: 'applicable statutory interest under governing commercial law.', // length 61 (indices 170..230)
      transform: [10, 0, 0, 10, 50, 160],
      width: 610,
      height: 12,
      hasEOL: false,
    },
  ];

  const page3Items = [
    {
      str: 'Third page concluding remarks and sign-off.',
      transform: [10, 0, 0, 10, 50, 500],
      width: 400,
      height: 12,
      hasEOL: true,
    },
  ];

  it('(a) EOL-spanning query across line break returns 1 result on page 2 with two bounding boxes and expected id', async () => {
    const pdfDoc = createMockPdf([{ items: page1Items }, { items: page2Items }, { items: page3Items }]);
    const query = 'net thirty days from the date of a valid invoice. Late payments';

    const results = await searchPdfText(pdfDoc as any, query);

    expect(results).toHaveLength(1);
    const match = results[0];
    expect(match.pageIndex).toBe(2);
    expect(match.id).toBe('p2-idx53');
    expect(match.bounds).toHaveLength(2);

    // First box: Item 1 ('net thirty days from the date of a valid invoice.') - 49 chars, charWidth = 10
    expect(match.bounds[0]).toEqual({
      x: 50,
      y: 200,
      width: 490,
      height: 12,
    });

    // Second box: Item 2 ('Late payments' - 13 chars), charWidth = 660 / 66 = 10
    expect(match.bounds[1]).toEqual({
      x: 50,
      y: 180,
      width: 130,
      height: 12,
    });
  });

  it('(b) tabs, NBSP, and double space query variants return identical id and bounds', async () => {
    const pdfDoc = createMockPdf([{ items: page1Items }, { items: page2Items }, { items: page3Items }]);
    const canonicalResults = await searchPdfText(
      pdfDoc as any,
      'net thirty days from the date of a valid invoice. Late payments'
    );
    expect(canonicalResults).toHaveLength(1);

    const variants = [
      'net  thirty\tdays\u00A0from the date of a valid invoice.   Late\tpayments',
      '  net thirty days   from the date of a valid invoice. \n Late payments  ',
      'net thirty\tdays from the date of a valid invoice. Late payments',
    ];

    for (const variant of variants) {
      const results = await searchPdfText(pdfDoc as any, variant);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(canonicalResults[0].id);
      expect(results[0].bounds).toEqual(canonicalResults[0].bounds);
    }
  });

  it('(c) multi-line excerpt matches as one query with bounds.length === items.length', async () => {
    const pdfDoc = createMockPdf([{ items: page1Items }, { items: page2Items }, { items: page3Items }]);
    // Query spanning all 4 items on page 2:
    // Item 0: '...settled within '
    // Item 1: 'net thirty days from the date of a valid invoice.'
    // Item 2: 'Late payments are subject to a 1.5% monthly finance charge and the'
    // Item 3: 'applicable statutory...'
    const query =
      'settled within net thirty days from the date of a valid invoice. Late payments are subject to a 1.5% monthly finance charge and the applicable statutory';

    const results = await searchPdfText(pdfDoc as any, query, [], undefined, [2]);
    expect(results).toHaveLength(1);
    expect(results[0].bounds).toHaveLength(4);
    expect(results[0].bounds.length).toBe(page2Items.length);
  });

  it('(d) regression pin for "Hello World" item', async () => {
    const pdfDoc = createMockPdf([{ items: page1Items }]);
    const results = await searchPdfText(pdfDoc as any, 'World');

    expect(results).toHaveLength(1);
    const match = results[0];
    expect(match.id).toBe('p1-idx6');
    expect(match.pageIndex).toBe(1);
    expect(match.matchStartIndex).toBe(6);
    expect(match.matchLength).toBe(5);
    expect(match.bounds).toEqual([{ x: 110, y: 100, width: 50, height: 12 }]);
    expect(match.snippet).toContain('Hello World');
  });

  it('(e) sidebar contract: snippet match slice equals raw span with newlines replaced by space', async () => {
    const multiSpacePage = [
      {
        str: 'finance charge and  the penalty',
        transform: [10, 0, 0, 10, 50, 100],
        width: 310,
        height: 12,
        hasEOL: true,
      },
    ];
    const pdfDoc = createMockPdf([{ items: multiSpacePage }]);

    // Query 'and the' is 7 chars, but raw span 'and  the' in text has 2 spaces (8 chars)
    const results = await searchPdfText(pdfDoc as any, 'and the');
    expect(results).toHaveLength(1);

    const match = results[0];
    expect(match.matchLength).toBe(8);
    const extractedFromSnippet = match.snippet.substring(
      match.matchStartIndex,
      match.matchStartIndex + match.matchLength
    );
    expect(extractedFromSnippet).toBe('and  the');

    // Also verify for line-spanning query:
    const eolPdf = createMockPdf([{ items: page2Items }]);
    const eolResults = await searchPdfText(
      eolPdf as any,
      'net thirty days from the date of a valid invoice. Late payments'
    );
    expect(eolResults).toHaveLength(1);
    const eolMatch = eolResults[0];
    const eolSlice = eolMatch.snippet.substring(
      eolMatch.matchStartIndex,
      eolMatch.matchStartIndex + eolMatch.matchLength
    );
    expect(eolSlice).toBe('net thirty days from the date of a valid invoice. Late payments');
  });

  it('(f) ID uniqueness for recurring patterns', async () => {
    const repeatItems = [
      {
        str: 'x y x y',
        transform: [10, 0, 0, 10, 50, 100],
        width: 70,
        height: 12,
        hasEOL: true,
      },
      {
        str: 'x\n\n\ny',
        transform: [10, 0, 0, 10, 50, 80],
        width: 70,
        height: 12,
        hasEOL: false,
      },
    ];
    const pdfDoc = createMockPdf([{ items: repeatItems }]);
    const results = await searchPdfText(pdfDoc as any, 'x y');

    expect(results.length).toBeGreaterThanOrEqual(2);
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids[0]).toBe('p1-idx0');
    expect(ids[1]).toBe('p1-idx4');
  });

  it('(g) pages option filtering: [2] searches only page 2; [99] returns []; [2, 2, 1] deduplicates and sorts', async () => {
    const pdfDoc = createMockPdf([{ items: page1Items }, { items: page2Items }, { items: page3Items }]);

    // Only page 2
    const resultsPage2 = await searchPdfText(pdfDoc as any, 'payments', [], undefined, [2]);
    expect(resultsPage2).toHaveLength(1);
    expect(resultsPage2[0].pageIndex).toBe(2);
    expect(pdfDoc.getPage).toHaveBeenCalledWith(2);
    expect(pdfDoc.getPage).not.toHaveBeenCalledWith(1);
    expect(pdfDoc.getPage).not.toHaveBeenCalledWith(3);

    // Out-of-bounds page [99]
    vi.clearAllMocks();
    const progressFn = vi.fn();
    const resultsEmpty = await searchPdfText(pdfDoc as any, 'payments', [], progressFn, [99]);
    expect(resultsEmpty).toEqual([]);
    expect(pdfDoc.getPage).not.toHaveBeenCalled();
    expect(progressFn).toHaveBeenCalledWith(100);

    // [2, 2, 1] deduplicates and visits in ascending order [1, 2]
    vi.clearAllMocks();
    const resultsDedup = await searchPdfText(pdfDoc as any, 'the', [], undefined, [2, 2, 1]);
    expect(resultsDedup.every(r => r.pageIndex === 1 || r.pageIndex === 2)).toBe(true);
    expect(pdfDoc.getPage).toHaveBeenCalledWith(1);
    expect(pdfDoc.getPage).toHaveBeenCalledWith(2);
    expect(pdfDoc.getPage).not.toHaveBeenCalledWith(3);
  });

  it('(h) whitespace-free query parity, intra-page ascending order preservation, and onProgress reaches 100', async () => {
    const multiMatchItems = [
      { str: 'term beta term alpha term gamma', transform: [10, 0, 0, 10, 50, 100], width: 300, height: 12, hasEOL: false },
    ];
    const pdfDoc = createMockPdf([{ items: multiMatchItems }, { items: page2Items }]);
    const progressCalls: number[] = [];

    const results = await searchPdfText(
      pdfDoc as any,
      'term',
      [],
      p => progressCalls.push(p)
    );

    expect(results.length).toBeGreaterThan(1);

    // Intra-page order: strictly ascending matchStartIndex / rawStart
    const page1Results = results.filter(r => r.pageIndex === 1);
    for (let i = 1; i < page1Results.length; i++) {
      expect(page1Results[i].matchStartIndex).toBeGreaterThan(page1Results[i - 1].matchStartIndex);
    }

    // Page ordering: strictly non-decreasing pageIndex
    for (let i = 1; i < results.length; i++) {
      expect(results[i].pageIndex).toBeGreaterThanOrEqual(results[i - 1].pageIndex);
    }

    // onProgress reached 100
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1]).toBe(100);
  });

  it('excludes items intersecting redaction rectangles', async () => {
    const pdfDoc = createMockPdf([
      {
        items: [
          { str: 'Secret confidential data', transform: [10, 0, 0, 10, 50, 700], width: 200, height: 12, hasEOL: false },
          { str: 'Public data', transform: [10, 0, 0, 10, 50, 650], width: 100, height: 12, hasEOL: false },
        ],
        viewport: { width: 612, height: 792 },
      },
    ]);

    // Redaction covering the confidential item
    // vp.height = 792, itemTopY = 792 - 700 - 12 = 80
    const redactions = [
      {
        id: 'red-1',
        pageIndex: 1,
        x: 40,
        y: 70,
        width: 220,
        height: 30,
        status: 'pending' as const,
      },
    ];

    const resultsConfidential = await searchPdfText(pdfDoc as any, 'confidential', redactions);
    expect(resultsConfidential).toEqual([]);

    const resultsPublic = await searchPdfText(pdfDoc as any, 'Public', redactions);
    expect(resultsPublic).toHaveLength(1);
  });

  it('handles empty query or whitespace-only query gracefully', async () => {
    const pdfDoc = createMockPdf([{ items: page1Items }]);
    expect(await searchPdfText(pdfDoc as any, '')).toEqual([]);
    expect(await searchPdfText(pdfDoc as any, '   ')).toEqual([]);
    expect(await searchPdfText(null as any, 'hello')).toEqual([]);
  });
});
