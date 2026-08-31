/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { useContext, useEffect, useRef } from 'react';
import { ViewerBusContext } from '../core/busContext';
import type { ViewerBus, BusListener } from '../core/eventBus';

export function useViewerBus(): ViewerBus {
  const bus = useContext(ViewerBusContext);
  if (!bus) {
    throw new Error('[teamsync-pdf-viewer] useViewerBus() must be used inside <TeamSyncViewer>.');
  }
  return bus;
}

/**
 * Subscribe to a bus event for the lifetime of the component.
 * The latest `listener` is always invoked (no stale closures) without re-subscribing on every render.
 */
export function useBusEvent<T = unknown>(type: string, listener: BusListener<T>): void {
  const bus = useViewerBus();
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => bus.on<T>(type, (detail) => ref.current(detail)), [bus, type]);
}
