import { describe, it, expect } from "vitest";
import { minimapCells } from "../src/ui/minimap";
import { createScene, applyEvent, sceneAt } from "../src/ui/scene";
import type { GeometryRoom } from "../src/engine/data/room-geometry";
import { layoutRooms, getFloorGeometry } from "../src/engine/data/room-geometry";
import type { RunEvent } from "../src/engine/run";

// A small floor: rooms 1-3 hold spawns; room 4 is corridor-only geometry.
const GEO: GeometryRoom[] = [
  { room: 1, x: 0, z: 0 },
  { room: 2, x: 100, z: 0 },
  { room: 3, x: 100, z: 100 },
  { room: 4, x: 0, z: 100 },
];
// 4 generated rooms: room 2's big wave was split into plan indices 1 and 2.
const PLAN: (number | null)[] = [1, 2, 2, 3];

const roomEvent = (roomIndex: number, enemies = 1): RunEvent => ({
  t: roomIndex,
  kind: "room",
  text: `Entering room ${roomIndex + 1} of ${PLAN.length}.`,
  room: {
    roomIndex,
    totalRooms: PLAN.length,
    boxes: 0,
    enemies: Array.from({ length: enemies }, () => ({ id: "booma", name: "Booma", maxHp: 30 })),
  },
});

const stateOf = (cells: ReturnType<typeof minimapCells>, room: number) =>
  cells.find((c) => c.room === room)!.state;

describe("minimapCells (battle-minimap spec)", () => {
  it("renders all geometry rooms from the first frame, spawnless rooms structural", () => {
    const scene = createScene(100, {});
    const cells = minimapCells(GEO, PLAN, scene);
    expect(cells).toHaveLength(4);
    expect(stateOf(cells, 1)).toBe("unknown");
    expect(stateOf(cells, 2)).toBe("unknown");
    expect(stateOf(cells, 3)).toBe("unknown");
    expect(stateOf(cells, 4)).toBe("structural"); // no waves → never lights up
  });

  it("marks the entered room current and passed rooms cleared", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent(0));
    let cells = minimapCells(GEO, PLAN, scene);
    expect(stateOf(cells, 1)).toBe("current");
    expect(stateOf(cells, 2)).toBe("unknown");

    applyEvent(scene, roomEvent(1));
    cells = minimapCells(GEO, PLAN, scene);
    expect(stateOf(cells, 1)).toBe("cleared");
    expect(stateOf(cells, 2)).toBe("current");
  });

  it("keeps a split room current until every generated room of it is cleared", () => {
    const scene = createScene(100, {});
    applyEvent(scene, roomEvent(1));
    applyEvent(scene, roomEvent(2)); // second half of authentic room 2
    const cells = minimapCells(GEO, PLAN, scene);
    // Plan index 1 cleared, but index 2 (same authentic room) is current.
    expect(stateOf(cells, 2)).toBe("current");

    applyEvent(scene, roomEvent(3));
    expect(stateOf(minimapCells(GEO, PLAN, scene), 2)).toBe("cleared");
  });

  it("completion clears every spawn room; structural rooms stay structural", () => {
    const scene = createScene(100, {});
    for (let i = 0; i < 4; i++) applyEvent(scene, roomEvent(i));
    applyEvent(scene, { t: 9, kind: "complete", text: "Area cleared!" });
    const cells = minimapCells(GEO, PLAN, scene);
    for (const room of [1, 2, 3]) expect(stateOf(cells, room)).toBe("cleared");
    expect(stateOf(cells, 4)).toBe("structural");
  });

  it("is outcome-blind: identical cells for the same revealed prefix of a doomed run", () => {
    // Two runs reveal the same three events; one will later eject, one will
    // complete. Until a settle event is revealed the cells must be identical.
    const revealed = [roomEvent(0), roomEvent(1)];
    const doomed = sceneAt(revealed, 100, {});
    const winning = sceneAt(revealed, 100, {});
    expect(minimapCells(GEO, PLAN, doomed)).toEqual(minimapCells(GEO, PLAN, winning));

    // After the eject reveals, the map freezes (no room flips to cleared).
    applyEvent(doomed, { t: 9, kind: "eject", text: "Ejected!" });
    const cells = minimapCells(GEO, PLAN, doomed);
    expect(stateOf(cells, 1)).toBe("cleared"); // was already passed
    expect(stateOf(cells, 2)).toBe("unknown"); // never completed — not cleared
  });

  it("refolding a prefix reproduces incremental states (reload equivalence)", () => {
    const events = [roomEvent(0), roomEvent(1), roomEvent(2)];
    const incremental = createScene(100, {});
    for (const e of events) applyEvent(incremental, e);
    const refolded = sceneAt(events, 100, {});
    expect(minimapCells(GEO, PLAN, refolded)).toEqual(minimapCells(GEO, PLAN, incremental));
  });
});

describe("room-geometry dataset (room-geometry-data spec)", () => {
  it("Forest 1 has a single 16-room layout", () => {
    const geo = getFloorGeometry("1", 1)!;
    expect(Object.keys(geo.layouts)).toEqual(["01-00"]);
    expect(geo.layouts["01-00"]).toHaveLength(16);
  });

  it("multi-layout floors expose three layouts keyed by area-variant", () => {
    for (const floor of [3, 4, 5, 6, 7, 8, 9, 10]) {
      const geo = getFloorGeometry("1", floor)!;
      expect(Object.keys(geo.layouts), `floor ${floor}`).toHaveLength(3);
    }
  });

  it("boss floors and unknown layouts return null", () => {
    expect(getFloorGeometry("1", 11)).toBeNull();
    expect(layoutRooms("1", 1, "no-such-layout")).toBeNull();
  });
});
