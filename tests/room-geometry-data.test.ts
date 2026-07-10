/** The simulation-facing room layout dataset contains provenance, not coordinates. */

import { describe, expect, it } from "vitest";
import { getFloorLayouts, layoutKeyForFile } from "../src/engine/data/room-layouts";

describe("room layout metadata", () => {
  it("maps spawn files without loading room coordinates", () => {
    const forest = getFloorLayouts("1", 1)!;
    expect(forest.fileToLayout["map_forest01_00_offe.dat"]).toBe("01-00");
    expect(forest).not.toHaveProperty("layouts");
    expect(layoutKeyForFile("1", 11, "map_boss01e.dat")).toBeNull();
  });
});
