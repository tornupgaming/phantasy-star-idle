/**
 * Minimap state (battle-minimap spec) — pure derivation of each authentic
 * room's display state from the planned stage (geometry + per-room provenance)
 * and the folded scene. Outcome-blind by construction: it reads only revealed
 * events (via the scene) and plan-level data, so a doomed run's minimap is
 * indistinguishable from a successful one until the run settles.
 *
 * An authentic room may span several generated rooms (waves are split at
 * MAX_ROOM_ENEMIES): it is `cleared` only when every generated room tagged
 * with it is cleared, and `current` while the revealed room index sits inside
 * it. Geometry rooms with no spawn waves are `structural` — they shape the
 * floor but never light up.
 */

import type { GeometryRoom } from "../engine/data/room-geometry";
import type { Scene } from "./scene";

export type MinimapRoomState = "structural" | "unknown" | "current" | "cleared";

export interface MinimapCell {
  room: number;
  x: number;
  z: number;
  state: MinimapRoomState;
}

export function minimapCells(
  geometry: GeometryRoom[],
  authRoomPlan: (number | null)[],
  scene: Scene,
): MinimapCell[] {
  const planIndices = new Map<number, number[]>();
  for (let i = 0; i < authRoomPlan.length; i++) {
    const authRoom = authRoomPlan[i];
    if (authRoom === null) continue;
    const list = planIndices.get(authRoom);
    if (list) list.push(i);
    else planIndices.set(authRoom, [i]);
  }

  // Same reveal discipline as the retired room grid: a generated room is
  // cleared once the run has moved past it (or the whole run completed), and
  // current while the revealed index sits on it.
  const done = scene.phase === "complete" || scene.phase === "ejected";
  const clearedIdx = (i: number) =>
    i < scene.roomIndex || (done && scene.phase === "complete");
  const currentIdx = (i: number) => i === scene.roomIndex && !done;

  return geometry.map((room) => {
    const indices = planIndices.get(room.room);
    let state: MinimapRoomState;
    if (!indices) {
      state = "structural";
    } else if (indices.every(clearedIdx)) {
      state = "cleared";
    } else if (indices.some(currentIdx)) {
      state = "current";
    } else {
      state = "unknown";
    }
    return { room: room.room, x: room.x, z: room.z, state };
  });
}
