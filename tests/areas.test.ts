import { describe, expect, it } from "vitest";
import { areaNormForFloor, type ZoneId } from "../src/engine/areas";
import { AREA_LIST, getArea } from "../src/engine/content";

describe("area_norm mapping", () => {
  it("maps wired non-boss floors explicitly", () => {
    expect(areaNormForFloor(1)).toBe(0); // Forest 1
    expect(areaNormForFloor(3)).toBe(2); // Cave 1
    expect(areaNormForFloor(6)).toBe(5); // Mine 1
  });

  it("applies the boss-floor rule to every boss arena", () => {
    expect(areaNormForFloor(11)).toBe(2); // Dragon → Cave 1
    expect(areaNormForFloor(12)).toBe(5); // De Rol Le → Mine 1
    expect(areaNormForFloor(13)).toBe(7); // Vol Opt → Ruins 1
    expect(areaNormForFloor(14)).toBe(9); // Dark Falz → Ruins 3
  });

  it("fails loudly for unknown floors", () => {
    expect(() => areaNormForFloor(99)).toThrow(/no area_norm mapping/);
  });
});

describe("Ep1 area catalog", () => {
  it("contains the ten regular floors and four boss arenas", () => {
    expect(AREA_LIST.map((a) => a.id)).toEqual([
      "forest-1",
      "forest-2",
      "dragon",
      "cave-1",
      "cave-2",
      "cave-3",
      "de-rol-le",
      "mine-1",
      "mine-2",
      "vol-opt",
      "ruins-1",
      "ruins-2",
      "ruins-3",
      "dark-falz",
    ]);
    expect(AREA_LIST.filter((a) => a.boss).map((a) => a.id)).toEqual([
      "dragon",
      "de-rol-le",
      "vol-opt",
      "dark-falz",
    ]);
  });

  it("groups zones in order, regular floors then the zone's boss", () => {
    const zones = AREA_LIST.map((a) => a.zone);
    expect([...new Set(zones)]).toEqual(["Forest", "Caves", "Mines", "Ruins"] as ZoneId[]);
    // Zones are contiguous, and each zone ends with its boss arena.
    for (const zone of new Set(zones)) {
      const group = AREA_LIST.filter((a) => a.zone === zone);
      const first = zones.indexOf(zone);
      expect(zones.slice(first, first + group.length)).toEqual(group.map(() => zone));
      expect(group.filter((a) => a.boss)).toHaveLength(1);
      expect(group[group.length - 1].boss).toBe(true);
    }
  });

  it("recommended ATP is monotonically non-decreasing within each zone", () => {
    for (const zone of ["Forest", "Caves", "Mines", "Ruins"] as ZoneId[]) {
      const group = AREA_LIST.filter((a) => a.zone === zone);
      for (let i = 1; i < group.length; i++) {
        expect(group[i].recommendedAtp).toBeGreaterThanOrEqual(group[i - 1].recommendedAtp);
      }
    }
  });

  it("legacy ids resolve for persisted references but are not listed", () => {
    expect(getArea("forest").floor).toBe(1);
    expect(getArea("caves").floor).toBe(3);
    const mines = getArea("mines");
    expect(mines.floor).toBe(6);
    expect(mines.bossFloor).toBe(11); // Dragon stays glued for replay identity
    expect(AREA_LIST.some((a) => ["forest", "caves", "mines"].includes(a.id))).toBe(false);
  });
});
