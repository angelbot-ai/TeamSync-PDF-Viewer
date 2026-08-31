import { describe, expect, it, vi } from 'vitest';
import { ViewerBus } from './eventBus';

describe('ViewerBus', () => {
  it('delivers details to subscribers and supports unsubscribe', () => {
    const bus = new ViewerBus();
    const seen: unknown[] = [];
    const off = bus.on<{ n: number }>('evt', (d) => seen.push(d.n));
    bus.emit('evt', { n: 1 });
    off();
    bus.emit('evt', { n: 2 });
    expect(seen).toEqual([1]);
    expect(bus.listenerCount('evt')).toBe(0);
  });

  it('once() fires a single time', () => {
    const bus = new ViewerBus();
    const fn = vi.fn();
    bus.once('evt', fn);
    bus.emit('evt');
    bus.emit('evt');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('isolates listener errors', () => {
    const bus = new ViewerBus();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const second = vi.fn();
    bus.on('evt', () => { throw new Error('boom'); });
    bus.on('evt', second);
    bus.emit('evt');
    expect(second).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('keeps instances isolated from each other', () => {
    const a = new ViewerBus();
    const b = new ViewerBus();
    const fn = vi.fn();
    a.on('evt', fn);
    b.emit('evt');
    expect(fn).not.toHaveBeenCalled();
  });

  it('destroy() drops listeners and refuses further use', () => {
    const bus = new ViewerBus();
    const fn = vi.fn();
    bus.on('evt', fn);
    bus.destroy();
    bus.emit('evt');
    bus.on('evt', fn);
    expect(fn).not.toHaveBeenCalled();
    expect(bus.listenerCount()).toBe(0);
    expect(bus.isDestroyed).toBe(true);
  });
});
