/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Per-instance event bus.
 *
 * Replaces the former `window.dispatchEvent(new CustomEvent('action-*'))` plumbing so that several
 * viewer instances can coexist on one page without cross-talk, and so that `destroy()` can drop
 * every listener an instance ever registered.
 */

export type BusListener<T = unknown> = (detail: T) => void;

export class ViewerBus {
  private readonly listeners = new Map<string, Set<BusListener<any>>>();
  private destroyed = false;

  /** Subscribe. Returns an unsubscribe function. */
  on<T = unknown>(type: string, listener: BusListener<T>): () => void {
    if (this.destroyed) return () => {};
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    return () => this.off(type, listener);
  }

  /** Subscribe for a single delivery. */
  once<T = unknown>(type: string, listener: BusListener<T>): () => void {
    const off = this.on<T>(type, (detail) => {
      off();
      listener(detail);
    });
    return off;
  }

  off<T = unknown>(type: string, listener: BusListener<T>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(type);
  }

  /** Dispatch synchronously to every listener. Listener errors are isolated and logged. */
  emit<T = unknown>(type: string, detail?: T): void {
    if (this.destroyed) return;
    const set = this.listeners.get(type);
    if (!set || set.size === 0) return;
    for (const listener of Array.from(set)) {
      try {
        listener(detail as T);
      } catch (err) {
        console.error(`[teamsync-pdf-viewer] listener for "${type}" threw`, err);
      }
    }
  }

  listenerCount(type?: string): number {
    if (type) return this.listeners.get(type)?.size ?? 0;
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }

  removeAll(): void {
    this.listeners.clear();
  }

  /** Drop every listener and refuse further subscriptions/emissions. */
  destroy(): void {
    this.removeAll();
    this.destroyed = true;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }
}
