/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

export type CompareMode = 'overlay' | 'side-by-side' | 'semantic';

export interface CompareOptions {
  docA?: string | ArrayBuffer | Uint8Array;
  docB?: string | ArrayBuffer | Uint8Array;
  mode?: CompareMode;
  colorA?: string; // Default: '#e11d48' (Red / Deletions)
  colorB?: string; // Default: '#0284c7' (Cyan / Additions)
  opacityA?: number; // Default: 0.75
  opacityB?: number; // Default: 0.75
  blendMode?: 'multiply' | 'difference' | 'screen' | 'normal'; // Default: 'multiply'
}

export interface TextDiffSegment {
  type: 'equal' | 'add' | 'delete';
  text: string;
  pageIndex: number;
}

export interface DiffItem {
  id: string;
  pageIndex: number;
  type: 'addition' | 'deletion' | 'modification';
  description: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface CompareState {
  isActive: boolean;
  docA?: string | ArrayBuffer | Uint8Array;
  docB?: string | ArrayBuffer | Uint8Array;
  mode: CompareMode;
  colorA: string;
  colorB: string;
  opacityA: number;
  opacityB: number;
  blendMode: 'multiply' | 'difference' | 'screen' | 'normal';
  curtainPosition: number; // Percentage 0 to 100
  showCurtain: boolean;
  diffItems: DiffItem[];
  currentDiffIndex: number;
}
