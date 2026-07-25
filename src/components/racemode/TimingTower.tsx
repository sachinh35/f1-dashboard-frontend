import React from "react";
import { getRosterEntry } from "../../data/driverRoster";
import { BattleRadarAlert, DriverTiming, TimingAppDataInfo, TimingStatsInfo } from "../../types/raceMode";
import BattleRadarIndicator from "./BattleRadarIndicator";

interface TimingTowerProps {
  drivers: Record<string, DriverTiming>;
  timingAppData: Record<string, TimingAppDataInfo>;
  timingStats: Record<string, TimingStatsInfo>;
  selectedDrivers: number[];
  onToggleDriver: (driverNumber: number) => void;
  battleRadar: Record<string, BattleRadarAlert>;
}

function latestCompound(info: TimingAppDataInfo | undefined): string {
  if (!info?.Stints) return "unknown";
  const stintNumbers = Object.keys(info.Stints)
    .map(Number)
    .sort((a, b) => a - b);
  const last = stintNumbers[stintNumbers.length - 1];
  const compound = last !== undefined ? info.Stints[String(last)]?.Compound : undefined;
  return (compound || "unknown").toLowerCase();
}

function lapTimeClass(lastLap: DriverTiming["LastLapTime"]): string {
  if (!lastLap?.Value) return "plain";
  if (lastLap.OverallFastest) return "purple";
  if (lastLap.PersonalFastest) return "green";
  return "plain";
}

const TimingTower: React.FC<TimingTowerProps> = ({
  drivers,
  timingAppData,
  timingStats,
  selectedDrivers,
  onToggleDriver,
  battleRadar,
}) => {
  const rows = Object.entries(drivers)
    .map(([driverStr, timing]) => ({ driverNumber: Number(driverStr), timing }))
    .sort((a, b) => {
      const posA = Number(a.timing.Position) || 999;
      const posB = Number(b.timing.Position) || 999;
      return posA - posB;
    });

  if (rows.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Waiting for timing data…</div>;
  }

  return (
    <div>
      {rows.map(({ driverNumber, timing }) => {
        const roster = getRosterEntry(driverNumber);
        const compound = latestCompound(timingAppData[String(driverNumber)]);
        const speedTrap = timingStats[String(driverNumber)]?.BestSpeeds?.ST?.Value;
        const selected = selectedDrivers.includes(driverNumber);

        return (
          <div
            key={driverNumber}
            className={`tower-row${selected ? " selected" : ""}`}
            onClick={() => onToggleDriver(driverNumber)}
            title="Click to compare this driver's telemetry"
          >
            <span className="pos">{timing.Position ?? "-"}</span>
            <span className="team-bar" style={{ background: roster.teamColor }} />
            <span className="drv">{roster.tla}</span>
            <span className="gap mono">{timing.GapToLeader ?? "-"}</span>
            <span className="battle-radar-slot">
              <BattleRadarIndicator alert={battleRadar[String(driverNumber)]} />
            </span>
            <span className={`lap mono ${lapTimeClass(timing.LastLapTime)}`}>{timing.LastLapTime?.Value ?? "-"}</span>
            <span className={`tyre-chip ${compound}`}>{compound !== "unknown" ? compound[0].toUpperCase() : "?"}</span>
            <span className="speed-trap mono">{speedTrap ?? "-"}</span>
            <span className="mono" style={{ color: "var(--flag-red)", fontSize: 10, fontWeight: 700 }}>
              {timing.InPit ? "PIT" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default TimingTower;
