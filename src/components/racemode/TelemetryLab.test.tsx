import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TelemetryLab, { scaleToBand } from "./TelemetryLab";
import { TelemetrySample } from "../../types/raceMode";

describe("scaleToBand", () => {
  it("maps a zero value to the bottom of the band", () => {
    expect(scaleToBand(0, 100, 0, 60)).toBe(60);
  });

  it("maps a value equal to domainMax to the top of the band", () => {
    expect(scaleToBand(100, 100, 0, 60)).toBe(0);
  });

  it("maps a mid-range value to the vertical midpoint of the band", () => {
    expect(scaleToBand(50, 100, 0, 60)).toBe(30);
  });

  it("offsets by bandTop for bands not starting at y=0", () => {
    expect(scaleToBand(0, 100, 82, 60)).toBe(142);
    expect(scaleToBand(100, 100, 82, 60)).toBe(82);
  });

  it("scales correctly against an arbitrary (non-percentage) domainMax", () => {
    // e.g. a driver's own rolling max speed used as the domain for the speed band
    expect(scaleToBand(150, 300, 0, 90)).toBe(45);
  });
});

const emptyRef = { current: {} as Record<string, TelemetrySample> };

describe("TelemetryLab", () => {
  it("renders the telemetry canvas", () => {
    const { container } = render(<TelemetryLab telemetryRef={emptyRef} selectedDrivers={[]} />);
    expect(container.querySelector("canvas.rm-telemetry-canvas")).not.toBeNull();
  });

  it("renders one legend entry per selected driver with the driver's TLA", () => {
    render(<TelemetryLab telemetryRef={emptyRef} selectedDrivers={[3, 16]} />);
    expect(screen.getByText(/^VER/)).toBeInTheDocument();
    expect(screen.getByText(/^LEC/)).toBeInTheDocument();
  });

  it("renders no legend entries when no drivers are selected", () => {
    const { container } = render(<TelemetryLab telemetryRef={emptyRef} selectedDrivers={[]} />);
    expect(container.querySelector(".rm-telemetry-legend")?.children.length).toBe(0);
  });
});
