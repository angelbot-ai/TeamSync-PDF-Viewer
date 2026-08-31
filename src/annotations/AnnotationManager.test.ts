import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnotationManager, type AnnotationChangedEvent } from './AnnotationManager';
import type { Annotation } from './types';

const rect = (id: string, extra: Partial<Annotation> = {}): Annotation => ({
  id, type: 'rectangle', pageIndex: 1, x: 10, y: 10, width: 50, height: 20, color: '#ff0000', strokeWidth: 2, opacity: 1, ...extra,
});

const fakeDoc = {
  numPages: 3,
  getPage: async (n: number) => ({ pageNumber: n, view: [0, 0, 612, 792], rotate: 0 }),
} as any;

describe('AnnotationManager', () => {
  let m: AnnotationManager;
  let events: AnnotationChangedEvent[];

  beforeEach(() => {
    m = new AnnotationManager();
    m.setCurrentUser('Jane', 'u-jane');
    events = [];
    m.addEventListener('annotationChanged', (e) => events.push(e));
  });

  it('stamps author + timestamps on new annotations and emits add', () => {
    const [a] = m.addAnnotations([{ ...rect('x'), id: undefined }]);
    expect(a.id).toMatch(/[0-9a-f-]{36}/);
    expect(a.author).toBe('Jane');
    expect(a.authorId).toBe('u-jane');
    expect(a.createdAt).toBeTruthy();
    expect(events).toEqual([{ annotations: [a], action: 'add', imported: false }]);
  });

  it('diffs a committed list into add / modify / delete events', () => {
    m.commit([rect('a'), rect('b')]);
    events.length = 0;
    const bMoved = { ...m.getAnnotationById('b')!, x: 99 };
    m.commit([bMoved, rect('c')]);
    expect(events.map((e) => e.action)).toEqual(['add', 'modify', 'delete']);
    expect(events[0].annotations[0].id).toBe('c');
    expect(events[1].annotations[0].x).toBe(99);
    expect(events[1].annotations[0].modifiedAt).toBeTruthy();
    expect(events[2].annotations[0].id).toBe('a');
  });

  it('keeps the list reference stable when nothing changes', () => {
    m.commit([rect('a')]);
    const before = m.getAnnotationsList();
    m.commit([...before]);
    expect(m.getAnnotationsList()).toBe(before);
  });

  it('rejects edits/deletes of other authors and everything when read-only', () => {
    m.commit([rect('mine'), rect('theirs', { authorId: 'u-peer', author: 'Peer' })], { imported: true, force: true });
    events.length = 0;

    // Modify + delete someone else's annotation: both rejected, mine goes through.
    const mine = m.getAnnotationById('mine')!;
    m.commit([{ ...mine, x: 1 }]); // theirs deleted, mine modified
    expect(m.getAnnotationById('theirs')).toBeTruthy();
    expect(m.getAnnotationById('mine')!.x).toBe(1);
    expect(events.map((e) => e.action)).toEqual(['modify']);

    m.setCanEditOthers(true);
    expect(m.canEdit(m.getAnnotationById('theirs')!)).toBe(true);

    m.setReadOnly(true);
    events.length = 0;
    m.commit([...m.getAnnotationsList(), rect('new')]);
    expect(m.getAnnotationById('new')).toBeUndefined();
    expect(events).toEqual([]);
    m.deleteAnnotations(['mine'], { force: true });
    expect(m.getAnnotationById('mine')).toBeUndefined();
  });

  it('undo / redo replay through events and are not affected by imports', () => {
    m.commit([rect('a')]);
    m.commit([...m.getAnnotationsList(), rect('b')]);
    events.length = 0;
    expect(m.undo()).toBe(true);
    expect(m.getAnnotationsList().map((a) => a.id)).toEqual(['a']);
    expect(events).toEqual([{ annotations: [expect.objectContaining({ id: 'b' })], action: 'delete', imported: false }]);
    expect(m.redo()).toBe(true);
    expect(m.getAnnotationsList().map((a) => a.id)).toEqual(['a', 'b']);
    expect(m.canRedo).toBe(false);
    // imports do not enter history
    m.commit([...m.getAnnotationsList(), rect('imp')], { imported: true, force: true });
    m.undo();
    expect(m.getAnnotationById('imp')).toBeTruthy();
  });

  it('imports XFDF (merge by name, flagged imported) and exports fragments', async () => {
    m.setDocument(fakeDoc);
    m.commit([rect('keep')]);
    events.length = 0;
    const imported = await m.importAnnotations(
      `<square page="0" rect="72,72,172,122" name="keep" title="Peer"/><circle page="2" rect="0,0,10,10" name="new" title="Peer"/>`
    );
    expect(imported.map((a) => a.id)).toEqual(['keep', 'new']);
    expect(m.getAnnotationById('new')!.pageIndex).toBe(3);
    expect(events.map((e) => [e.action, e.imported])).toEqual([['add', true], ['modify', true]]);
    expect(m.canUndo).toBe(true); // only the earlier user commit

    const frag = await m.exportAnnotations({ annotList: [m.getAnnotationById('new')!] });
    expect(frag.startsWith('<circle')).toBe(true);
    expect(frag).toContain('name="new"');
    const full = await m.exportAnnotations();
    expect(full.startsWith('<?xml')).toBe(true);
    expect(full).toContain('name="keep"');
  });

  it('throws on XFDF operations without a document', async () => {
    await expect(m.importAnnotations('<square/>')).rejects.toThrow(/no document/);
  });

  it('notifies list subscribers and isolates listener errors', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sub = vi.fn();
    m.subscribe(sub);
    m.addEventListener('annotationChanged', () => { throw new Error('boom'); });
    m.commit([rect('a')]);
    expect(sub).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
