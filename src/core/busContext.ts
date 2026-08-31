/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { createContext } from 'react';
import type { ViewerBus } from './eventBus';

/** Provided by <TeamSyncViewer>; every internal component reads its bus from here. */
export const ViewerBusContext = createContext<ViewerBus | null>(null);
