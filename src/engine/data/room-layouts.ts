/**
 * Typed loader for the small spawn-file -> room-layout provenance dataset.
 *
 * This module is safe for the synchronous simulation graph: it intentionally
 * contains no room coordinates. Full geometry lives in room-geometry.ts and
 * is loaded only by the deferred run UI.
 */

import rawDataset from "./room-layouts.json";
import type { Episode } from "./enemy-stats";

export interface FloorLayouts {
  floor: number;
  /** PSO area number (the layout-key prefix). */
  area: number;
  name: string;
  /** Offline spawn-variation file -> layout key of the map it plays on. */
  fileToLayout: Record<string, string>;
}

const DATASET = rawDataset as unknown as Partial<Record<Episode, FloorLayouts[]>>;

export function getFloorLayouts(episode: Episode, floor: number): FloorLayouts | null {
  return DATASET[episode]?.find((f) => f.floor === floor) ?? null;
}

/** Layout key a spawn variation file plays on, or null (boss floors, Ep2/4). */
export function layoutKeyForFile(episode: Episode, floor: number, file: string): string | null {
  return getFloorLayouts(episode, floor)?.fileToLayout[file] ?? null;
}
