/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * XFDF serializer / parser.
 *
 * Writes the subset of XFDF (ISO 32000 + Acrobat/Apryse conventions) that maps onto this viewer's
 * annotation model, and reads anything back. Elements it cannot model become `opaque`
 * annotations that re-export verbatim, and unknown attributes / children of known elements are
 * preserved in `xfdfExtras`, so a document can round-trip through another viewer (Apryse, Acrobat)
 * without losing metadata. Geometry goes through `annotations/geometry.ts`, the single coordinate
 * authority (base page space <-> PDF user space).
 */
import type { Annotation, AnnotationInput, AnnotationPoint } from './types';
import { newAnnotationId } from './ids';
import {
  fmt,
  pathFromPdf,
  pathToPdf,
  quadPointsToRects,
  rectFromPdf,
  rectToPdf,
  rectToQuadPoints,
  unionRects,
  type GeometryResolver,
  type PageGeometry,
  type PdfRect,
  type Point,
} from './geometry';

export const XFDF_NS = 'http://ns.adobe.com/xfdf/';

export interface XfdfExportOptions {
  /** Annotations to serialize (default: all given). */
  annotList?: Annotation[];
  /** Write the author's display name into `title` (default true). */
  useDisplayAuthor?: boolean;
}

/** Custom data namespace inside Apryse's `trn-custom-data` element (survives an Apryse round-trip). */
const CUSTOM_KEY = 'tspdf';

// ---- helpers ----------------------------------------------------------------------------------

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** ISO-8601 -> PDF date `D:YYYYMMDDHHmmSS+HH'mm'`. */
export function toPdfDate(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return toPdfDate(undefined);
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const tzh = pad(Math.floor(Math.abs(tz) / 60));
  const tzm = pad(Math.abs(tz) % 60);
  return `D:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${sign}${tzh}'${tzm}'`;
}

/** PDF date -> ISO-8601 (best effort; returns undefined when unparseable). */
export function fromPdfDate(pdf: string | null | undefined): string | undefined {
  if (!pdf) return undefined;
  const m = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([+\-Z])?(\d{2})?'?(\d{2})?/.exec(pdf.trim());
  if (!m) {
    const t = Date.parse(pdf);
    return Number.isNaN(t) ? undefined : new Date(t).toISOString();
  }
  const [, Y, Mo = '01', D = '01', h = '00', mi = '00', s = '00', tzs, tzh = '00', tzm = '00'] = m;
  let offset = '';
  if (tzs === 'Z' || !tzs) offset = 'Z';
  else offset = `${tzs}${tzh}:${tzm}`;
  const t = Date.parse(`${Y}-${Mo}-${D}T${h}:${mi}:${s}${offset}`);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

const toHexColor = (c: string | undefined): string | undefined => {
  if (!c || c === 'transparent') return undefined;
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toUpperCase();
  return undefined;
};

const attr = (name: string, value: string | number | undefined | null): string =>
  value === undefined || value === null || value === '' ? '' : ` ${name}="${escapeXml(String(value))}"`;

function customDataElement(data: Record<string, unknown>): string {
  return `<trn-custom-data bytes="${escapeXml(JSON.stringify({ [CUSTOM_KEY]: data }))}"/>`;
}

function readCustomData(el: Element): Record<string, unknown> {
  const node = Array.from(el.children).find((c) => c.localName === 'trn-custom-data');
  if (!node) return {};
  try {
    const parsed = JSON.parse(node.getAttribute('bytes') || '{}');
    const data = parsed?.[CUSTOM_KEY];
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function pointsAttr(points: Point[]): string {
  return points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(';');
}

function parsePoints(s: string | null): Point[] {
  if (!s) return [];
  return s
    .split(';')
    .map((pair) => pair.trim().split(/[,\s]+/).map(Number))
    .filter((xy) => xy.length >= 2 && xy.every((n) => Number.isFinite(n)))
    .map(([x, y]) => ({ x, y }));
}

function parseNumbers(s: string | null): number[] {
  if (!s) return [];
  return s.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
}

function pdfRectAttr(r: PdfRect): string {
  return r.map(fmt).join(',');
}

/** Attributes we own on every element (so they are not carried over from `xfdfExtras`). */
const OWNED_ATTRS = new Set([
  'page', 'rect', 'color', 'interior-color', 'width', 'opacity', 'name', 'title', 'subject', 'date',
  'creationdate', 'flags', 'coords', 'start', 'end', 'head', 'tail', 'icon', 'IT', 'callout', 'style',
]);
/** Child elements we own / regenerate. */
const OWNED_CHILDREN = new Set(['contents', 'contents-richtext', 'inklist', 'imagedata', 'OnActivation', 'trn-custom-data', 'defaultstyle', 'defaultappearance', 'popup', 'vertices']);

// ---- export -----------------------------------------------------------------------------------

function commonAttrs(a: Annotation, g: PageGeometry, useDisplayAuthor: boolean, rectOverride?: PdfRect): string {
  const rect = rectOverride ?? rectToPdf(g, { x: a.x, y: a.y, width: a.width, height: a.height });
  const created = a.createdAt ?? (a.timestamp ? new Date(a.timestamp).toISOString() : undefined);
  const flags = ['print', ...(a.readOnly ? ['readonly', 'locked'] : [])].join(',');
  return (
    attr('page', a.pageIndex - 1) +
    attr('rect', pdfRectAttr(rect)) +
    attr('name', a.id) +
    (useDisplayAuthor ? attr('title', a.author) : '') +
    attr('date', toPdfDate(a.modifiedAt ?? created)) +
    attr('creationdate', toPdfDate(created)) +
    attr('flags', flags) +
    attr('opacity', a.opacity !== undefined && a.opacity !== 1 ? fmt(a.opacity) : undefined)
  );
}

function extraAttrs(a: Annotation): string {
  const attrs = a.xfdfExtras?.attrs;
  if (!attrs) return '';
  return Object.entries(attrs)
    .filter(([k]) => !OWNED_ATTRS.has(k))
    .map(([k, v]) => attr(k, v))
    .join('');
}

function extraChildren(a: Annotation): string {
  return (a.xfdfExtras?.children ?? []).join('');
}

function customData(a: Annotation, extra: Record<string, unknown> = {}): string {
  const data: Record<string, unknown> = { type: a.type, ...extra };
  if (a.authorId) data.authorId = a.authorId;
  if (a.strokeWidth !== undefined) data.strokeWidth = a.strokeWidth;
  return customDataElement(data);
}

const contentsElement = (text: string | undefined): string => (text ? `<contents>${escapeXml(text)}</contents>` : '');

const defaultStyle = (a: Annotation, size: number): string =>
  `<defaultstyle>font: Helvetica ${size}pt; text-align: left; color: ${toHexColor(a.color) ?? '#000000'}</defaultstyle>` +
  `<defaultappearance>0 0 0 rg /Helv ${size} Tf</defaultappearance>`;

/** Serialize one annotation to an XFDF element (no envelope). */
export async function annotationToXfdfFragment(a: Annotation, resolve: GeometryResolver, opts: XfdfExportOptions = {}): Promise<string> {
  if (a.type === 'opaque' && a.rawXfdf) return a.rawXfdf;
  const g = await resolve(a.pageIndex);
  const useDisplayAuthor = opts.useDisplayAuthor !== false;
  const color = toHexColor(a.color);
  const strokeAttrs = attr('color', color) + attr('width', a.strokeWidth);
  const common = (rect?: PdfRect) => commonAttrs(a, g, useDisplayAuthor, rect) + extraAttrs(a);
  const tail = (extra: Record<string, unknown> = {}) => customData(a, extra) + extraChildren(a);

  switch (a.type) {
    case 'rectangle':
      return `<square${common()}${strokeAttrs}${attr('interior-color', color)} subject="Rectangle">${tail()}</square>`;
    case 'ellipse':
      return `<circle${common()}${strokeAttrs}${attr('interior-color', color)} subject="Ellipse">${tail()}</circle>`;
    case 'line':
    case 'arrow': {
      const pts = a.points && a.points.length >= 2 ? a.points : [{ x: a.x, y: a.y }, { x: a.x + a.width, y: a.y + a.height }];
      const [s, e] = pathToPdf(g, [pts[0], pts[1]]);
      const rect: PdfRect = [Math.min(s.x, e.x), Math.min(s.y, e.y), Math.max(s.x, e.x), Math.max(s.y, e.y)];
      const head = a.type === 'arrow' ? attr('head', 'OpenArrow') : '';
      return `<line${common(rect)}${strokeAttrs} start="${fmt(s.x)},${fmt(s.y)}" end="${fmt(e.x)},${fmt(e.y)}"${head} subject="${a.type === 'arrow' ? 'Arrow' : 'Line'}">${tail()}</line>`;
    }
    case 'freehand': {
      const strokes = a.strokes && a.strokes.length > 0 ? a.strokes : a.points ? [a.points] : [];
      const gestures = strokes.map((st) => `<gesture>${pointsAttr(pathToPdf(g, st))}</gesture>`).join('');
      const all = strokes.flat();
      const bbox = all.length ? rectToPdf(g, boundsOf(all, a.strokeWidth)) : undefined;
      return `<ink${common(bbox)}${strokeAttrs} subject="Free Hand"><inklist>${gestures}</inklist>${tail()}</ink>`;
    }
    case 'highlight':
    case 'underline':
    case 'strikeout':
    case 'squiggly': {
      const rects = a.rects && a.rects.length > 0 ? a.rects : [{ x: a.x, y: a.y, width: a.width, height: a.height }];
      const coords = rects.flatMap((r) => rectToQuadPoints(g, r)).map(fmt).join(',');
      const bbox = rectToPdf(g, unionRects(rects));
      const tag = a.type;
      const subject = a.type === 'highlight' ? 'Highlight' : a.type === 'underline' ? 'Underline' : a.type === 'strikeout' ? 'StrikeOut' : 'Squiggly';
      return `<${tag}${common(bbox)}${attr('color', color)} coords="${coords}" subject="${subject}">${tail()}</${tag}>`;
    }
    case 'text':
      return `<freetext${common()}${attr('color', color)} subject="Free Text">${contentsElement(a.text)}${defaultStyle(a, 16)}${tail()}</freetext>`;
    case 'callout': {
      const pts = a.points && a.points.length >= 2 ? a.points : [{ x: a.x, y: a.y }, { x: a.x, y: a.y }];
      const [s, e] = pathToPdf(g, [pts[0], pts[1]]);
      const boxRect = rectToPdf(g, { x: pts[1].x, y: pts[1].y, width: a.text ? a.text.length * 8 + 20 : 100, height: 24 });
      const bbox: PdfRect = [Math.min(s.x, boxRect[0]), Math.min(s.y, boxRect[1]), Math.max(e.x, boxRect[2]), Math.max(e.y, boxRect[3])];
      return `<freetext${common(bbox)}${strokeAttrs} IT="FreeTextCallout" callout="${fmt(s.x)},${fmt(s.y)},${fmt(e.x)},${fmt(e.y)}" subject="Callout">${contentsElement(a.text)}${defaultStyle(a, 14)}${tail({ box: boxRect })}</freetext>`;
    }
    case 'note':
      return `<text${common(rectToPdf(g, { x: a.x, y: a.y, width: 24, height: 24 }))}${attr('color', color)} icon="Comment" subject="Sticky Note">${contentsElement(a.text)}${tail()}</text>`;
    case 'link': {
      const url = a.linkUrl ?? '';
      const action = url.startsWith('#page=')
        ? `<OnActivation><Action Trigger="U"><GoTo><Dest><Fit Page="${Math.max(0, (parseInt(url.slice(6), 10) || 1) - 1)}"/></Dest></GoTo></Action></OnActivation>`
        : url
          ? `<OnActivation><Action Trigger="U"><URI Name="${escapeXml(url)}"/></Action></OnActivation>`
          : '';
      return `<link${common()}${attr('color', color)} subject="Link">${action}${contentsElement(a.text)}${tail()}</link>`;
    }
    case 'signature':
      return `<stamp${common()} subject="Signature">${a.imageUrl ? `<imagedata>${escapeXml(a.imageUrl)}</imagedata>` : ''}${tail({ signer: a.signer, signType: a.signType, timestamp: a.timestamp })}</stamp>`;
    case 'digital_signature_placeholder':
      return `<stamp${common()} subject="Digital Signature">${tail({ signer: a.signer, timestamp: a.timestamp })}</stamp>`;
    case 'opaque':
      return a.rawXfdf ?? '';
    default:
      return '';
  }
}

function boundsOf(points: AnnotationPoint[], pad = 0) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const half = pad / 2;
  const x = Math.min(...xs) - half;
  const y = Math.min(...ys) - half;
  return { x, y, width: Math.max(...xs) - x + half, height: Math.max(...ys) - y + half };
}

/** Serialize annotations to a complete XFDF document. */
export async function annotationsToXfdf(annotations: Annotation[], resolve: GeometryResolver, opts: XfdfExportOptions = {}): Promise<string> {
  const list = opts.annotList ?? annotations;
  const fragments = await Promise.all(list.map((a) => annotationToXfdfFragment(a, resolve, opts)));
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<xfdf xmlns="${XFDF_NS}" xml:space="preserve"><annots>${fragments.filter(Boolean).join('')}</annots></xfdf>`
  );
}

// ---- import -----------------------------------------------------------------------------------

function collectExtras(el: Element): Annotation['xfdfExtras'] {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) {
    if (!OWNED_ATTRS.has(a.name) && !a.name.startsWith('xmlns')) attrs[a.name] = a.value;
  }
  const children: string[] = [];
  for (const c of Array.from(el.children)) {
    if (!OWNED_CHILDREN.has(c.localName)) children.push(new XMLSerializer().serializeToString(c));
  }
  // Keep Apryse custom data that is not ours (e.g. teamsyncId) verbatim.
  const custom = Array.from(el.children).find((c) => c.localName === 'trn-custom-data');
  if (custom) {
    try {
      const parsed = JSON.parse(custom.getAttribute('bytes') || '{}');
      if (parsed && typeof parsed === 'object') {
        const rest = { ...parsed };
        delete rest[CUSTOM_KEY];
        if (Object.keys(rest).length > 0) {
          children.push(`<trn-custom-data bytes="${escapeXml(JSON.stringify(rest))}"/>`);
        }
      }
    } catch {
      children.push(new XMLSerializer().serializeToString(custom));
    }
  }
  const out: Annotation['xfdfExtras'] = {};
  if (Object.keys(attrs).length) out.attrs = attrs;
  if (children.length) out.children = children;
  return Object.keys(out).length ? out : undefined;
}

function childText(el: Element, name: string): string | undefined {
  const c = Array.from(el.children).find((x) => x.localName === name);
  return c?.textContent ?? undefined;
}

function baseFromElement(el: Element, g: PageGeometry): Omit<AnnotationInput, 'type'> & { id: string } {
  const rectNums = parseNumbers(el.getAttribute('rect'));
  const rect = rectNums.length === 4 ? rectFromPdf(g, [rectNums[0], rectNums[1], rectNums[2], rectNums[3]]) : { x: 0, y: 0, width: 0, height: 0 };
  const custom = readCustomData(el);
  const color = toHexColor(el.getAttribute('color') || el.getAttribute('interior-color') || undefined) ?? '#000000';
  const opacityAttr = el.getAttribute('opacity');
  const opacity = opacityAttr !== null && Number.isFinite(Number(opacityAttr)) ? Number(opacityAttr) : 1;
  const widthAttr = el.getAttribute('width');
  const strokeWidth = typeof custom.strokeWidth === 'number' ? custom.strokeWidth : widthAttr !== null && Number.isFinite(Number(widthAttr)) ? Number(widthAttr) : 1;
  const flags = (el.getAttribute('flags') || '').toLowerCase();
  const readOnly = flags.includes('readonly') || flags.includes('locked');
  return {
    id: el.getAttribute('name') || newAnnotationId(),
    pageIndex: (parseInt(el.getAttribute('page') || '0', 10) || 0) + 1,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color,
    strokeWidth,
    opacity,
    author: el.getAttribute('title') || undefined,
    authorId: typeof custom.authorId === 'string' ? custom.authorId : undefined,
    createdAt: fromPdfDate(el.getAttribute('creationdate')),
    modifiedAt: fromPdfDate(el.getAttribute('date')),
    readOnly: readOnly || undefined,
    xfdfExtras: collectExtras(el),
  };
}

function elementToAnnotation(el: Element, g: PageGeometry): Annotation | null {
  const kind = el.localName.toLowerCase();
  const custom = readCustomData(el);
  const base = baseFromElement(el, g);

  const opaque = (): Annotation => ({
    ...base,
    type: 'opaque',
    opaqueKind: kind,
    rawXfdf: new XMLSerializer().serializeToString(el),
    xfdfExtras: undefined,
  });

  switch (kind) {
    case 'square':
      return { ...base, type: 'rectangle' };
    case 'circle':
      return { ...base, type: 'ellipse' };
    case 'line': {
      const s = parseNumbers(el.getAttribute('start'));
      const e = parseNumbers(el.getAttribute('end'));
      const head = (el.getAttribute('head') || 'None').toLowerCase();
      const tailAttr = (el.getAttribute('tail') || 'None').toLowerCase();
      if (s.length < 2 || e.length < 2) return opaque();
      const [ps, pe] = pathFromPdf(g, [{ x: s[0], y: s[1] }, { x: e[0], y: e[1] }]);
      const bounds = boundsOf([ps, pe]);
      const isArrow = head !== 'none' || tailAttr !== 'none';
      return { ...base, ...bounds, type: isArrow ? 'arrow' : 'line', points: [ps, pe] };
    }
    case 'ink': {
      const gestures = Array.from(el.getElementsByTagName('*')).filter((n) => n.localName === 'gesture');
      const strokes = gestures.map((ge) => pathFromPdf(g, parsePoints(ge.textContent))).filter((st) => st.length > 0);
      if (strokes.length === 0) return opaque();
      const all = strokes.flat();
      return { ...base, ...boundsOf(all), type: 'freehand', points: strokes[0], strokes };
    }
    case 'highlight':
    case 'underline':
    case 'strikeout':
    case 'squiggly': {
      const quads = parseNumbers(el.getAttribute('coords'));
      const rects = quads.length >= 8 ? quadPointsToRects(g, quads) : [{ x: base.x, y: base.y, width: base.width, height: base.height }];
      const bbox = unionRects(rects);
      const type = kind as 'highlight' | 'underline' | 'strikeout' | 'squiggly';
      const defaultOpacity = type === 'highlight' ? 0.5 : 1;
      return {
        ...base,
        ...bbox,
        type,
        rects: rects.length > 1 ? rects : undefined,
        opacity: base.opacity === 1 && type === 'highlight' ? 0.5 : (base.opacity ?? defaultOpacity)
      };
    }
    case 'freetext': {
      const text = childText(el, 'contents') ?? '';
      const it = el.getAttribute('IT') || '';
      const callout = parseNumbers(el.getAttribute('callout'));
      if (it === 'FreeTextCallout' || custom.type === 'callout' || callout.length >= 4) {
        const pts = callout.length >= 4 ? pathFromPdf(g, [{ x: callout[0], y: callout[1] }, { x: callout[2], y: callout[3] }]) : [{ x: base.x, y: base.y }, { x: base.x, y: base.y }];
        return { ...base, type: 'callout', text, points: pts, x: pts[1].x, y: pts[1].y, width: Math.max(100, text.length * 8 + 20), height: 30 };
      }
      return { ...base, type: 'text', text, width: Math.max(base.width, 100), height: Math.max(base.height, 30) };
    }
    case 'text':
      return { ...base, type: 'note', text: childText(el, 'contents') ?? '', width: 24, height: 24 };
    case 'link': {
      const uri = Array.from(el.getElementsByTagName('*')).find((n) => n.localName === 'URI');
      const fit = Array.from(el.getElementsByTagName('*')).find((n) => n.localName === 'Fit' || n.localName === 'XYZ' || n.localName === 'FitH');
      let linkUrl = uri?.getAttribute('Name') ?? '';
      if (!linkUrl && fit) linkUrl = `#page=${(parseInt(fit.getAttribute('Page') || '0', 10) || 0) + 1}`;
      return { ...base, type: 'link', linkUrl, text: childText(el, 'contents') ?? '', color: 'transparent', strokeWidth: 0, opacity: 1, points: [] };
    }
    case 'stamp': {
      const image = childText(el, 'imagedata');
      if (custom.type === 'digital_signature_placeholder') {
        return { ...base, type: 'digital_signature_placeholder', signer: typeof custom.signer === 'string' ? custom.signer : undefined, timestamp: typeof custom.timestamp === 'number' ? custom.timestamp : undefined };
      }
      if (image) {
        return { ...base, type: 'signature', imageUrl: image, signer: typeof custom.signer === 'string' ? custom.signer : undefined, timestamp: typeof custom.timestamp === 'number' ? custom.timestamp : undefined };
      }
      return opaque();
    }
    default:
      return opaque();
  }
}

/**
 * Parse an XFDF document OR bare annotation elements (a concatenation of fragments) into
 * annotations. Unknown elements become `opaque` (re-exported verbatim).
 */
/** Remove every `<?xml … ?>` declaration (linear scan — no regex backtracking on hostile input). */
function stripXmlDeclarations(input: string): string {
  let out = '';
  let pos = 0;
  for (;;) {
    const start = input.indexOf('<?xml', pos);
    if (start === -1) break;
    const end = input.indexOf('?>', start + 5);
    if (end === -1) break;
    out += input.slice(pos, start);
    pos = end + 2;
  }
  return out + input.slice(pos);
}

export async function parseXfdf(xml: string, resolve: GeometryResolver): Promise<Annotation[]> {
  // Hosts may store one full XFDF document per annotation and concatenate them inside an
  // envelope, so XML declarations can appear anywhere and <xfdf>/<annots> wrappers can nest.
  // Strip every declaration and collect annotation elements from every <annots> at any depth.
  const cleaned = stripXmlDeclarations(xml).trim();
  if (!cleaned) return [];
  // XFDF never carries a DTD; refuse one outright (entity expansion / external entity tricks).
  if (/<!DOCTYPE|<!ENTITY/i.test(cleaned)) {
    throw new Error('[teamsync-pdf-viewer] invalid XFDF: DOCTYPE/ENTITY declarations are not allowed');
  }
  // Parsed as application/xml: the parser is inert (no script execution, no resource loading)
  // and the resulting DOM is only read as data.
  const wrapped = `<xfdf xmlns="${XFDF_NS}"><annots>${cleaned}</annots></xfdf>`;
  const doc = new DOMParser().parseFromString(wrapped, 'application/xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error) throw new Error(`[teamsync-pdf-viewer] invalid XFDF: ${error.textContent?.slice(0, 200)}`);

  const WRAPPERS = new Set(['xfdf', 'annots', 'fields', 'f', 'ids']);
  const elements = Array.from(doc.getElementsByTagName('*')).filter(
    (n) => n.parentElement?.localName === 'annots' && !WRAPPERS.has(n.localName)
  );
  const out: Annotation[] = [];
  for (const el of elements) {
    const page = (parseInt(el.getAttribute('page') || '0', 10) || 0) + 1;
    const g = await resolve(page);
    const ann = elementToAnnotation(el, g);
    if (ann) out.push(ann);
  }
  return out;
}
