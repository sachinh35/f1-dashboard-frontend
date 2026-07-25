import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TimingTower from "./TimingTower";

describe("TimingTower", () => {
  it("shows a waiting message when no drivers have arrived yet", () => {
    render(
      <TimingTower
        drivers={{}}
        timingAppData={{}}
        timingStats={{}}
        selectedDrivers={[]}
        onToggleDriver={vi.fn()}
        battleRadar={{}}
      />
    );
    expect(screen.getByText(/waiting for timing data/i)).toBeInTheDocument();
  });

  it("renders driver rows sorted by real race position, not driver-object insertion order", () => {
    const drivers = {
      "1": { Position: "2" },
      "3": { Position: "1" },
    };
    render(
      <TimingTower
        drivers={drivers}
        timingAppData={{}}
        timingStats={{}}
        selectedDrivers={[]}
        onToggleDriver={vi.fn()}
        battleRadar={{}}
      />
    );
    const tlas = screen.getAllByText(/^(VER|NOR)$/).map((el) => el.textContent);
    expect(tlas).toEqual(["VER", "NOR"]); // VER is Position "1", must render first despite being driver "1"'s neighbor
  });

  it("calls onToggleDriver with the clicked driver's number", () => {
    const onToggle = vi.fn();
    render(
      <TimingTower
        drivers={{ "3": { Position: "1" } }}
        timingAppData={{}}
        timingStats={{}}
        selectedDrivers={[]}
        onToggleDriver={onToggle}
        battleRadar={{}}
      />
    );
    fireEvent.click(screen.getByText("VER"));
    expect(onToggle).toHaveBeenCalledWith(3);
  });

  it("marks the fastest lap purple and shows the tyre compound initial", () => {
    render(
      <TimingTower
        drivers={{ "3": { Position: "1", LastLapTime: { Value: "1:24.021", OverallFastest: true } } }}
        timingAppData={{ "3": { Stints: { "1": { Compound: "MEDIUM" } } } }}
        timingStats={{}}
        selectedDrivers={[]}
        onToggleDriver={vi.fn()}
        battleRadar={{}}
      />
    );
    const lapTime = screen.getByText("1:24.021");
    expect(lapTime.className).toContain("purple");
    expect(screen.getByText("M")).toBeInTheDocument();
  });
});
