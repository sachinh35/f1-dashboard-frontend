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
        teamRadioClips={[]}
        isQualifying={false}
        eliminatedDrivers={[]}
        qualifyingGaps={{}}
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
        teamRadioClips={[]}
        isQualifying={false}
        eliminatedDrivers={[]}
        qualifyingGaps={{}}
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
        teamRadioClips={[]}
        isQualifying={false}
        eliminatedDrivers={[]}
        qualifyingGaps={{}}
      />
    );
    fireEvent.click(screen.getByText("VER"));
    expect(onToggle).toHaveBeenCalledWith(3);
  });

  it("marks the fastest lap purple and shows the tyre compound initial (race mode - last lap)", () => {
    render(
      <TimingTower
        drivers={{ "3": { Position: "1", LastLapTime: { Value: "1:24.021", OverallFastest: true } } }}
        timingAppData={{ "3": { Stints: { "1": { Compound: "MEDIUM" } } } }}
        timingStats={{}}
        selectedDrivers={[]}
        onToggleDriver={vi.fn()}
        battleRadar={{}}
        teamRadioClips={[]}
        isQualifying={false}
        eliminatedDrivers={[]}
        qualifyingGaps={{}}
      />
    );
    const lapTime = screen.getByText("1:24.021");
    expect(lapTime.className).toContain("purple");
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("shows GapToLeader in the gap column outside qualifying", () => {
    render(
      <TimingTower
        drivers={{ "3": { Position: "1", GapToLeader: "+1.234" } }}
        timingAppData={{}}
        timingStats={{}}
        selectedDrivers={[]}
        onToggleDriver={vi.fn()}
        battleRadar={{}}
        teamRadioClips={[]}
        isQualifying={false}
        eliminatedDrivers={[]}
        qualifyingGaps={{}}
      />
    );
    expect(screen.getByText("+1.234")).toBeInTheDocument();
  });

  describe("qualifying mode", () => {
    it("shows the backend-computed qualifyingGaps value in the gap column, not GapToLeader or F1's own Stats field", () => {
      // GapToLeader/Stats are both ignored in qualifying: GapToLeader is a race-only
      // concept F1 never sends during qualifying, and F1's own Stats field proved
      // unreliable (wrong index, never cleared for a new leader) - see TimingTower.tsx.
      render(
        <TimingTower
          drivers={{
            "3": {
              Position: "2",
              GapToLeader: "+1.234",
              Stats: { "0": { TimeDiffToFastest: "+9.999" } },
            },
          }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{ "3": 0.512 }}
        />
      );
      expect(screen.getByText("+0.512")).toBeInTheDocument();
      expect(screen.queryByText("+1.234")).not.toBeInTheDocument();
      expect(screen.queryByText("+9.999")).not.toBeInTheDocument();
    });

    it("shows a dash (not '+0.000') for the session leader", () => {
      render(
        <TimingTower
          drivers={{ "3": { Position: "1" } }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{ "3": 0 }}
        />
      );
      const gapCells = document.querySelectorAll(".gap.mono");
      expect(gapCells).toHaveLength(1);
      expect(gapCells[0].textContent).toBe("-");
    });

    it("shows a dash when the driver has no valid best lap yet (no entry in qualifyingGaps)", () => {
      render(
        <TimingTower
          drivers={{ "3": { Position: "5" } }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{}}
        />
      );
      const gapCells = document.querySelectorAll(".gap.mono");
      expect(gapCells).toHaveLength(1);
      expect(gapCells[0].textContent).toBe("-");
    });

    it("shows the session-best lap, not the last lap, even when last lap was slower", () => {
      render(
        <TimingTower
          drivers={{
            "3": {
              Position: "1",
              BestLapTime: { Value: "1:20.000", Lap: 2 },
              LastLapTime: { Value: "1:25.000", OverallFastest: false },
            },
          }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{}}
        />
      );
      expect(screen.getByText("1:20.000")).toBeInTheDocument();
      expect(screen.queryByText("1:25.000")).not.toBeInTheDocument();
    });

    it("shows a dash when a driver has no valid best lap (e.g. their only lap was deleted)", () => {
      render(
        <TimingTower
          drivers={{ "3": { Position: "21", BestLapTime: { Value: "" } } }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{}}
        />
      );
      // Row renders (position 21), but no lap time text - dashes for the missing best lap.
      expect(screen.getByText("21")).toBeInTheDocument();
    });

    it("renders per-sector times with fastest-sector coloring", () => {
      render(
        <TimingTower
          drivers={{
            "3": {
              Position: "1",
              BestLapTime: { Value: "1:20.000" },
              Sectors: {
                "0": { Value: "26.391", PersonalFastest: true },
                "1": { Value: "30.000", OverallFastest: true },
                "2": { Value: "23.609" },
              },
            },
          }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{}}
        />
      );
      const s1 = screen.getByText("26.391");
      const s2 = screen.getByText("30.000");
      expect(s1.className).toContain("green");
      expect(s2.className).toContain("purple");
      expect(screen.getByText("23.609")).toBeInTheDocument();
    });

    it("shows the full tyre stint history, not just the current compound", () => {
      render(
        <TimingTower
          drivers={{ "3": { Position: "1" } }}
          timingAppData={{
            "3": {
              Stints: {
                "1": { Compound: "MEDIUM" },
                "2": { Compound: "SOFT" },
              },
            },
          }}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{}}
        />
      );
      expect(screen.getByText("M")).toBeInTheDocument();
      expect(screen.getByText("S")).toBeInTheDocument();
    });

    it("dedups consecutive stints on the same compound (soft, soft, soft -> just soft)", () => {
      render(
        <TimingTower
          drivers={{ "3": { Position: "1" } }}
          timingAppData={{
            "3": {
              Stints: {
                "1": { Compound: "SOFT" },
                "2": { Compound: "SOFT" },
                "3": { Compound: "SOFT" },
              },
            },
          }}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{}}
        />
      );
      expect(screen.getAllByText("S")).toHaveLength(1);
    });

    it("keeps a re-fitted compound as a separate entry only when it's a real change (medium, soft, soft -> medium, soft)", () => {
      render(
        <TimingTower
          drivers={{ "3": { Position: "1" } }}
          timingAppData={{
            "3": {
              Stints: {
                "1": { Compound: "MEDIUM" },
                "2": { Compound: "SOFT" },
                "3": { Compound: "SOFT" },
              },
            },
          }}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{}}
        />
      );
      expect(screen.getAllByText("M")).toHaveLength(1);
      expect(screen.getAllByText("S")).toHaveLength(1);
    });

    it("marks an eliminated driver with an OUT badge", () => {
      render(
        <TimingTower
          drivers={{ "3": { Position: "18" }, "5": { Position: "1" } }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[3]}
          qualifyingGaps={{}}
        />
      );
      expect(screen.getByText("OUT")).toBeInTheDocument();
    });

    it("does not show an OUT badge for a driver who is not eliminated", () => {
      render(
        <TimingTower
          drivers={{ "5": { Position: "1" } }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[3]}
          qualifyingGaps={{}}
        />
      );
      expect(screen.queryByText("OUT")).not.toBeInTheDocument();
    });

    it("labels the speed column as Speed Trap rather than a bare number", () => {
      render(
        <TimingTower
          drivers={{ "3": { Position: "1" } }}
          timingAppData={{}}
          timingStats={{}}
          selectedDrivers={[]}
          onToggleDriver={vi.fn()}
          battleRadar={{}}
          teamRadioClips={[]}
          isQualifying={true}
          eliminatedDrivers={[]}
          qualifyingGaps={{}}
        />
      );
      expect(screen.getByText("Speed Trap")).toBeInTheDocument();
    });
  });
});
