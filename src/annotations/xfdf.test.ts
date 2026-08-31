import { describe, expect, it } from 'vitest';
import { createPageGeometry, type GeometryResolver } from './geometry';
import { annotationToXfdfFragment, annotationsToXfdf, fromPdfDate, parseXfdf, toPdfDate } from './xfdf';
import type { Annotation } from './types';

const LETTER = createPageGeometry(1, [0, 0, 612, 792], 0);
const resolve: GeometryResolver = async () => LETTER;

const base = { pageIndex: 1, color: '#d32f2f', strokeWidth: 2, opacity: 0.8, author: 'Jane', authorId: 'u-1', createdAt: '2026-08-31T10:00:00.000Z' };

const samples: Annotation[] = [
  { ...base, id: 'rect-1', type: 'rectangle', x: 100, y: 50, width: 200, height: 30 },
  { ...base, id: 'ell-1', type: 'ellipse', x: 10, y: 20, width: 40, height: 60 },
  { ...base, id: 'line-1', type: 'line', x: 0, y: 0, width: 0, height: 0, points: [{ x: 10, y: 10 }, { x: 110, y: 60 }] },
  { ...base, id: 'arrow-1', type: 'arrow', x: 0, y: 0, width: 0, height: 0, points: [{ x: 10, y: 10 }, { x: 110, y: 60 }] },
  { ...base, id: 'ink-1', type: 'freehand', x: 0, y: 0, width: 0, height: 0, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 9 }] },
  { ...base, id: 'hl-1', type: 'highlight', x: 100, y: 50, width: 200, height: 18, opacity: 0.5, color: '#fbc02d' },
  { ...base, id: 'txt-1', type: 'text', x: 30, y: 40, width: 120, height: 30, text: 'Hello <world> & "friends"' },
  { ...base, id: 'note-1', type: 'note', x: 30, y: 40, width: 24, height: 24, text: 'Sticky' },
  { ...base, id: 'co-1', type: 'callout', x: 200, y: 300, width: 100, height: 30, text: 'Look here', points: [{ x: 50, y: 60 }, { x: 200, y: 300 }] },
  { ...base, id: 'link-1', type: 'link', x: 5, y: 5, width: 120, height: 35, linkUrl: 'https://teamsync.link/x?y=1&z=2', text: 'site', color: 'transparent', strokeWidth: 0, opacity: 1, points: [] },
  { ...base, id: 'plink-1', type: 'link', x: 5, y: 5, width: 120, height: 35, linkUrl: '#page=3', text: '', color: 'transparent', strokeWidth: 0, opacity: 1, points: [] },
  { ...base, id: 'sig-1', type: 'signature', x: 10, y: 10, width: 200, height: 60, imageUrl: 'data:image/png;base64,AAAA', signer: 'Jane', timestamp: 1700000000000 },
  { ...base, id: 'dsig-1', type: 'digital_signature_placeholder', x: 10, y: 10, width: 350, height: 70, signer: 'Jane', timestamp: 1700000000000 },
];

describe('xfdf', () => {
  it('formats and parses PDF dates', () => {
    const iso = '2026-08-31T10:00:00.000Z';
    const pdf = toPdfDate(iso);
    expect(pdf.startsWith('D:2026')).toBe(true);
    expect(fromPdfDate(pdf)).toBe(iso);
    expect(fromPdfDate("D:20260831100000Z")).toBe(iso);
    expect(fromPdfDate('garbage')).toBeUndefined();
  });

  it('writes a fragment with page-space geometry, id, author and flags', async () => {
    const xml = await annotationToXfdfFragment(samples[0], resolve);
    expect(xml.startsWith('<square')).toBe(true);
    expect(xml).toContain('page="0"');
    expect(xml).toContain('rect="100,712,300,742"');
    expect(xml).toContain('name="rect-1"');
    expect(xml).toContain('title="Jane"');
    expect(xml).toContain('color="#D32F2F"');
    expect(xml).toContain('opacity="0.8"');
    expect(xml).toContain('flags="print"');
    expect(xml).toContain('trn-custom-data');
  });

  it('round-trips every supported type through XFDF', async () => {
    const xml = await annotationsToXfdf(samples, resolve);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><xfdf xmlns="http://ns.adobe.com/xfdf/"')).toBe(true);
    const back = await parseXfdf(xml, resolve);
    expect(back.map((a) => a.id)).toEqual(samples.map((a) => a.id));

    for (const original of samples) {
      const parsed = back.find((a) => a.id === original.id)!;
      expect(parsed.type).toBe(original.type);
      expect(parsed.pageIndex).toBe(1);
      expect(parsed.author).toBe('Jane');
      expect(parsed.authorId).toBe('u-1');
      expect(parsed.createdAt).toBe(base.createdAt);
      if (original.type === 'rectangle' || original.type === 'ellipse' || original.type === 'signature' || original.type === 'digital_signature_placeholder' || original.type === 'highlight') {
        expect(parsed.x).toBeCloseTo(original.x, 2);
        expect(parsed.y).toBeCloseTo(original.y, 2);
        expect(parsed.width).toBeCloseTo(original.width, 2);
        expect(parsed.height).toBeCloseTo(original.height, 2);
      }
      if (original.points && (original.type === 'line' || original.type === 'arrow' || original.type === 'callout')) {
        expect(parsed.points![0].x).toBeCloseTo(original.points[0].x, 2);
        expect(parsed.points![1].y).toBeCloseTo(original.points[1].y, 2);
      }
      if (original.type === 'freehand') {
        expect(parsed.points!.length).toBe(3);
        expect(parsed.points![2].y).toBeCloseTo(9, 2);
      }
      if (original.text !== undefined && original.type !== 'link') expect(parsed.text).toBe(original.text);
      if (original.type === 'link') expect(parsed.linkUrl).toBe(original.linkUrl);
      if (original.type === 'signature') expect(parsed.imageUrl).toBe(original.imageUrl);
      if (original.type === 'digital_signature_placeholder') expect(parsed.signer).toBe('Jane');
    }
  });

  it('parses bare fragments and Apryse-style attributes', async () => {
    const frag =
      `<square page="1" rect="72,72,172,122" color="#00FF00" interior-color="#00FF00" width="3" opacity="0.4" name="apryse-1" title="Peer" subject="Rectangle" date="D:20260831120000+05'30'" flags="print,readonly">` +
      `<trn-custom-data bytes="{&quot;teamsyncId&quot;:&quot;db-42&quot;}"/></square>`;
    const [a] = await parseXfdf(frag, resolve);
    expect(a.type).toBe('rectangle');
    expect(a.id).toBe('apryse-1');
    expect(a.pageIndex).toBe(2);
    expect(a.color).toBe('#00FF00');
    expect(a.strokeWidth).toBe(3);
    expect(a.opacity).toBe(0.4);
    expect(a.readOnly).toBe(true);
    expect(a.author).toBe('Peer');
    expect(a.xfdfExtras?.children?.[0]).toContain('teamsyncId');

    // Re-export keeps the foreign custom data and the id.
    const out = await annotationToXfdfFragment(a, resolve);
    expect(out).toContain('name="apryse-1"');
    expect(out).toContain('teamsyncId');
    expect(out).toContain('flags="print,readonly,locked"');
  });

  it('keeps unsupported elements as opaque annotations and re-exports them verbatim', async () => {
    const frag = `<underline page="0" rect="10,20,110,40" color="#0000FF" name="ul-1" coords="10,40,110,40,10,20,110,20"/>`;
    const [a] = await parseXfdf(frag, resolve);
    expect(a.type).toBe('opaque');
    expect(a.opaqueKind).toBe('underline');
    expect(a.width).toBeCloseTo(100, 3);
    const out = await annotationToXfdfFragment(a, resolve);
    expect(out).toContain('<underline');
    expect(out).toContain('name="ul-1"');
  });

  it('rejects malformed XML', async () => {
    await expect(parseXfdf('<square page="0"', resolve)).rejects.toThrow(/invalid XFDF/);
  });
});

describe('xfdf envelope tolerance', () => {
  it('parses an envelope whose entries are themselves full XFDF documents (Apryse-style rows)', async () => {
    const row1 = `<?xml version="1.0" encoding="UTF-8"?><xfdf xmlns="http://ns.adobe.com/xfdf/"><annots><square page="0" rect="0,0,10,10" name="a"/></annots></xfdf>`;
    const row2 = `<circle page="0" rect="0,0,10,10" name="b"/>`;
    const envelope = `<?xml version="1.0" encoding="UTF-8"?><xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve"><annots>${row1}${row2}</annots></xfdf>`;
    const anns = await parseXfdf(envelope, resolve);
    expect(anns.map((a) => a.id)).toEqual(['a', 'b']);
  });
});
