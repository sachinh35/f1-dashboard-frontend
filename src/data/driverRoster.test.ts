import { describe, expect, it } from "vitest";
import { DRIVER_ROSTER, getRosterEntry } from "./driverRoster";

describe("getRosterEntry", () => {
  it("returns real roster data for a known driver number", () => {
    const entry = getRosterEntry(1);
    expect(entry.tla).toBe("VER");
    expect(entry.team).toBe("Red Bull Racing");
  });

  it("falls back to a generic entry for an unknown driver number", () => {
    const entry = getRosterEntry(999);
    expect(entry.tla).toBe("999");
    expect(entry.fullName).toBe("Driver 999");
    expect(entry.team).toBe("Unknown");
  });

  it("every roster entry has a valid 6-digit hex team color", () => {
    Object.values(DRIVER_ROSTER).forEach((entry) => {
      expect(entry.teamColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it("has exactly 20 drivers, matching a full grid", () => {
    expect(Object.keys(DRIVER_ROSTER)).toHaveLength(20);
  });
});
