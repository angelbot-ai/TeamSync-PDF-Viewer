/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * AnnotationManager — the canonical annotation list of a viewer instance.
 *
 * Responsibilities:
 *   - single source of truth for the annotation list (React reads it via subscribe/getSnapshot)
 *   - undo / redo history for user edits
 *   - granular `annotationChanged` events (`add` | `modify` | `delete`, with an `imported` flag)
 *     mirroring Apryse's annotationManager so host persistence bridges are near drop-in
 *   - authorship stamping and edit permissions (read-only viewer, read-only annotation, other
 *     author's annotation) enforced centrally in `commit()`
 *   - XFDF import / export through `annotations/xfdf.ts` + `annotations/geometry.ts`
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Annotation, AnnotationInput } from './types';
import { newAnnotationId } from './ids';
import { createGeometryResolver, type GeometryResolver } from './geometry';
import { annotationsToXfdf, annotationToXfdfFragment, parseXfdf, type XfdfExportOptions } from './xfdf';

export type AnnotationAction = 'add' | 'modify' | 'delete';

export interface AnnotationChangedEvent {
  annotations: Annotation[];
  action: AnnotationAction;
  /** True when the change came from importAnnotations()/programmatic APIs flagged as imported. */
  imported: boolean;
}

export interface CommitOptions {
  /** Mark the change as an import round-trip (not persisted by host bridges, not undoable). */
  imported?: boolean;
  /** Bypass read-only / authorship checks (programmatic host operations). */
  force?: boolean;
  /** Record in the undo history (default: true unless imported). */
  undoable?: boolean;
}

export interface ViewerUserInfo {
  id?: string;
  name?: string;
}

type ChangedListener = (event: AnnotationChangedEvent) => void;

/** One undoable user action, recorded as the operations it performed (not a snapshot), so undo
 *  and redo leave annotations imported in between untouched. */
interface HistoryEntry {
  added: Annotation[];
  modified: Array<{ before: Annotation; after: Annotation }>;
  deleted: Annotation[];
}

const MAX_HISTORY = 100;
const nowIso = () => new Date().toISOString();

export class AnnotationManager {
  private list: Annotation[] = [];
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private changedListeners = new Set<ChangedListener>();
  private listListeners = new Set<() => void>();
  private user: ViewerUserInfo = {};
  private readOnly = false;
  private canEditOthers = false;
  private resolver: GeometryResolver | null = null;

  // ---- document / user / permissions ------------------------------------------------------

  setDocument(doc: PDFDocumentProxy | null): void {
    this.resolver = doc ? createGeometryResolver(doc) : null;
  }

  hasDocument(): boolean {
    return this.resolver !== null;
  }

  setCurrentUser(name: string, id?: string): void {
    this.user = { name, id: id ?? this.user.id };
  }

  setCurrentUserInfo(user: ViewerUserInfo | undefined): void {
    this.user = { ...(user ?? {}) };
  }

  getCurrentUser(): string {
    return this.user.name ?? '';
  }

  getCurrentUserInfo(): ViewerUserInfo {
    return { ...this.user };
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  isReadOnly(): boolean {
    return this.readOnly;
  }

  /** Allow editing/deleting annotations authored by other users (default false). */
  setCanEditOthers(value: boolean): void {
    this.canEditOthers = value;
  }

  /** Whether the current user may modify or delete this annotation through the UI. */
  canEdit(a: Annotation): boolean {
    if (this.readOnly || a.readOnly || a.type === 'opaque') return false;
    if (this.canEditOthers) return true;
    if (!a.authorId && !a.author) return true; // unattributed (legacy / local draft)
    if (a.authorId) return Boolean(this.user.id) && a.authorId === this.user.id;
    return Boolean(this.user.name) && a.author === this.user.name;
  }

  canAdd(): boolean {
    return !this.readOnly;
  }

  // ---- reading --------------------------------------------------------------------------------

  /** The current list. The array reference is stable until the next change. */
  getAnnotationsList(): Annotation[] {
    return this.list;
  }

  getAnnotationById(id: string): Annotation | undefined {
    return this.list.find((a) => a.id === id);
  }

  /** React `useSyncExternalStore` pair. */
  subscribe = (listener: () => void): (() => void) => {
    this.listListeners.add(listener);
    return () => { this.listListeners.delete(listener); };
  };

  getSnapshot = (): Annotation[] => this.list;

  addEventListener(type: 'annotationChanged', listener: ChangedListener): () => void {
    if (type !== 'annotationChanged') return () => {};
    this.changedListeners.add(listener);
    return () => this.removeEventListener(type, listener);
  }

  removeEventListener(type: 'annotationChanged', listener: ChangedListener): void {
    if (type !== 'annotationChanged') return;
    this.changedListeners.delete(listener);
  }

  /** Apryse-compat no-op: React re-renders from the list. */
  drawAnnotationsFromList(_annotations: Annotation[]): void {}

  // ---- history --------------------------------------------------------------------------------

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): boolean {
    const entry = this.past.pop();
    if (!entry) return false;
    const addedIds = new Set(entry.added.map((a) => a.id));
    const before = new Map(entry.modified.map((m) => [m.after.id, m.before]));
    const next = this.list.filter((a) => !addedIds.has(a.id)).map((a) => before.get(a.id) ?? a);
    for (const d of entry.deleted) if (!next.some((a) => a.id === d.id)) next.push(d);
    this.future.unshift(entry);
    this.apply(next, { force: true, undoable: false, imported: false, keepHistory: true });
    return true;
  }

  redo(): boolean {
    const entry = this.future.shift();
    if (!entry) return false;
    const deletedIds = new Set(entry.deleted.map((a) => a.id));
    const after = new Map(entry.modified.map((m) => [m.before.id, m.after]));
    const next = this.list.filter((a) => !deletedIds.has(a.id)).map((a) => after.get(a.id) ?? a);
    for (const ad of entry.added) if (!next.some((a) => a.id === ad.id)) next.push(ad);
    this.past.push(entry);
    this.apply(next, { force: true, undoable: false, imported: false, keepHistory: true });
    return true;
  }

  // ---- mutation ---------------------------------------------------------------------------------

  /**
   * Replace the whole list (the UI's edit path). Diffs against the current list, enforces
   * permissions (rejected edits keep the previous version), records history and emits one
   * `annotationChanged` event per action.
   */
  commit(next: Annotation[], opts: CommitOptions = {}): Annotation[] {
    return this.apply(next, { ...opts, keepHistory: false });
  }

  addAnnotations(inputs: AnnotationInput[], opts: CommitOptions = {}): Annotation[] {
    const withIds = inputs.map((i) => ({ ...i, id: i.id ?? newAnnotationId() }) as Annotation);
    this.commit([...this.list, ...withIds], opts);
    return withIds.map((a) => this.getAnnotationById(a.id)).filter((a): a is Annotation => Boolean(a));
  }

  updateAnnotation(id: string, patch: Partial<AnnotationInput>, opts: CommitOptions = {}): Annotation | undefined {
    const existing = this.getAnnotationById(id);
    if (!existing) return undefined;
    this.commit(this.list.map((a) => (a.id === id ? { ...a, ...patch, id } : a)), opts);
    return this.getAnnotationById(id);
  }

  deleteAnnotations(targets: Array<Annotation | string>, opts: CommitOptions = {}): void {
    const ids = new Set(targets.map((t) => (typeof t === 'string' ? t : t.id)));
    this.commit(this.list.filter((a) => !ids.has(a.id)), opts);
  }

  /** Remove every annotation (e.g. on document switch). Not undoable, emits deletes as imported. */
  clear(): void {
    this.past = [];
    this.future = [];
    this.apply([], { imported: true, force: true, undoable: false, keepHistory: false });
  }

  // ---- XFDF -------------------------------------------------------------------------------------

  /**
   * Import an XFDF document or bare fragments. Annotations whose `name` already exists are
   * replaced (modify), new ones added; the change is flagged `imported` and is not undoable.
   * Returns the imported annotations as they now exist in the list.
   */
  async importAnnotations(xfdf: string): Promise<Annotation[]> {
    const resolver = this.requireResolver();
    const parsed = await parseXfdf(xfdf, resolver);
    if (parsed.length === 0) return [];
    const incoming = new Map(parsed.map((a) => [a.id, a]));
    const merged = this.list.map((a) => incoming.get(a.id) ?? a);
    for (const a of parsed) if (!this.list.some((x) => x.id === a.id)) merged.push(a);
    this.commit(merged, { imported: true, force: true, undoable: false });
    return parsed.map((a) => this.getAnnotationById(a.id)).filter((a): a is Annotation => Boolean(a));
  }

  /**
   * Export as XFDF. With `annotList`, returns the bare fragment(s) for those annotations (the
   * form hosts persist per annotation); without it, a complete XFDF document.
   */
  async exportAnnotations(opts: XfdfExportOptions = {}): Promise<string> {
    const resolver = this.requireResolver();
    if (opts.annotList) {
      const parts = await Promise.all(opts.annotList.map((a) => annotationToXfdfFragment(a, resolver, opts)));
      return parts.join('');
    }
    return annotationsToXfdf(this.list, resolver, opts);
  }

  /** Legacy bespoke JSON export (pre-1.2 `exportAnnotations()` shape). */
  exportAnnotationsLegacyJson(): string {
    return JSON.stringify(this.list, null, 2);
  }

  // ---- internals ----------------------------------------------------------------------------------

  private requireResolver(): GeometryResolver {
    if (!this.resolver) throw new Error('[teamsync-pdf-viewer] no document loaded — XFDF needs page geometry');
    return this.resolver;
  }

  private apply(next: Annotation[], opts: CommitOptions & { keepHistory: boolean }): Annotation[] {
    const prev = this.list;
    const imported = Boolean(opts.imported);
    const force = Boolean(opts.force);
    const prevById = new Map(prev.map((a) => [a.id, a]));
    const nextIds = new Set(next.map((a) => a.id));

    const added: Annotation[] = [];
    const modified: Annotation[] = [];
    const modifiedPairs: Array<{ before: Annotation; after: Annotation }> = [];
    const deleted: Annotation[] = [];
    const finalList: Annotation[] = [];

    for (const a of next) {
      const p = prevById.get(a.id);
      if (!p) {
        if (!imported && !force && this.readOnly) continue; // reject: viewer is read-only
        const stamped = this.stampNew(a, imported);
        added.push(stamped);
        finalList.push(stamped);
      } else if (p !== a) {
        if (!imported && !force && !this.canEdit(p)) {
          finalList.push(p); // reject the edit, keep the previous version
          continue;
        }
        const m: Annotation = imported ? a : { ...a, modifiedAt: nowIso() };
        modified.push(m);
        modifiedPairs.push({ before: p, after: m });
        finalList.push(m);
      } else {
        finalList.push(a);
      }
    }
    for (const p of prev) {
      if (nextIds.has(p.id)) continue;
      if (!imported && !force && !this.canEdit(p)) {
        finalList.push(p); // reject the deletion
        continue;
      }
      deleted.push(p);
    }

    if (added.length === 0 && modified.length === 0 && deleted.length === 0) {
      // Nothing effectively changed (all edits rejected or identical list): keep the reference.
      return this.list;
    }

    if (!opts.keepHistory && (opts.undoable ?? !imported)) {
      this.past.push({ added, modified: modifiedPairs, deleted });
      if (this.past.length > MAX_HISTORY) this.past.shift();
      this.future = [];
    }

    this.list = finalList;
    for (const l of Array.from(this.listListeners)) {
      try { l(); } catch (err) { console.error('[teamsync-pdf-viewer] list listener threw', err); }
    }
    if (added.length) this.emit({ annotations: added, action: 'add', imported });
    if (modified.length) this.emit({ annotations: modified, action: 'modify', imported });
    if (deleted.length) this.emit({ annotations: deleted, action: 'delete', imported });
    return this.list;
  }

  private stampNew(a: Annotation, imported: boolean): Annotation {
    if (imported) return a;
    const created = a.createdAt ?? nowIso();
    return {
      ...a,
      author: a.author ?? this.user.name,
      authorId: a.authorId ?? this.user.id,
      createdAt: created,
      modifiedAt: a.modifiedAt ?? created,
    };
  }

  private emit(event: AnnotationChangedEvent): void {
    for (const l of Array.from(this.changedListeners)) {
      try { l(event); } catch (err) { console.error('[teamsync-pdf-viewer] annotationChanged listener threw', err); }
    }
  }
}
