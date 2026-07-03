import { describe, expect, it } from "vitest";
import { areaNormForFloor } from "../src/engine/areas";

describe("area_norm mapping", () => {
  it("maps wired non-boss floors explicitly", () => {
    expect(areaNormForFloor(1)).toBe(0); // Forest 1
    expect(areaNormForFloor(3)).toBe(2); // Cave 1
    expect(areaNormForFloor(6)).toBe(5); // Mine 1
  });

  it("applies the Dragon boss-floor rule", () => {
    expect(areaNormForFloor(11)).toBe(2); // Dragon → Cave 1
  });

  it("fails loudly for unknown floors", () => {
    expect(() => areaNormForFloor(99)).toThrow(/no area_norm mapping/);
  });
});
