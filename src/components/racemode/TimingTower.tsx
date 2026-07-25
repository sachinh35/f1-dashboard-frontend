import React from "react";
import { getRosterEntry } from "../../data/driverRoster";
import { BattleRadarAlert, DriverTiming, TeamRadioClip, TimingAppDataInfo, TimingStatsInfo } from "../../types/raceMode";
import BattleRadarIndicator from "./BattleRadarIndicator";
import RadioIndicator from "./RadioIndicator";

interface TimingTowerProps {
  drivers: Record<string, DriverTiming>;
  timingAppData: Record<string, TimingAppDataInfo>;
  timingStats: Record<string, TimingStatsInfo>;
  selectedDrivers: number[];
  onToggleDriver: (driverNumber: number) => void;
  battleRadar: Record<string, BattleRadarAlert>;
  teamRadioClips: TeamRadioClip[];
  /** Qualifying shows each driver's session/segment-best lap (F1's own feed already
   * excludes deleted laps from BestLapTime - see SessionState.qualifying_part) instead of
   * the last-completed lap, which is what actually matters for a qualifying result;
   * a slower out/in lap should never visually overwrite a driver's flying-lap time. */
  isQualifying: boolean;
  /** Driver numbers knocked out at the end of a previous qualifying segment (Q1/Q2) -
   * see SessionState.eliminated_drivers. Ignored outside qualifying. */
  eliminatedDrivers: number[];
  /** Gap to the session-best lap this qualifying part, in seconds (0 for the leader) -
   * computed backend-side from BestLapTime, never from F1's own Stats field. Absent key
   * (not present in the record) = no valid lap yet, rendered as a dash. Ignored outside
   * qualifying (race mode uses GapToLeader instead). */
  qualifyingGaps: Record<string, number>;
}

/** Groups the full clip list by driver, so TimingTower's per-row RadioIndicator can show
 * every message for that driver (chronologically, on hover) without re-deriving it per row. */
function clipsByDriver(clips: TeamRadioClip[]): Record<number, TeamRadioClip[]> {
  const result: Record<number, TeamRadioClip[]> = {};
  for (const clip of clips) {
    (result[clip.driver_number] ??= []).push(clip);
  }
  return result;
}

/** Every compound used this session, oldest first, deduplicated so a run of stints on the
 * same compound (F1 can issue a new stint index for a fresh set of the same compound, e.g.
 * soft/soft/soft) collapses to one entry - only a genuine change of compound (e.g.
 * medium/soft/soft -> medium, soft) produces a new entry, matching what "has this driver
 * changed tyres" actually means. */
function compoundHistory(info: TimingAppDataInfo | undefined): string[] {
  if (!info?.Stints) return [];
  const raw = Object.keys(info.Stints)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => (info.Stints![String(n)]?.Compound || "unknown").toLowerCase());
  return raw.filter((compound, i) => i === 0 || compound !== raw[i - 1]);
}

function lapTimeClass(lap: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean } | undefined): string {
  if (!lap?.Value) return "plain";
  if (lap.OverallFastest) return "purple";
  if (lap.PersonalFastest) return "green";
  return "plain";
}

function sectorClass(sector: { PersonalFastest?: boolean; OverallFastest?: boolean } | undefined): string {
  if (!sector) return "plain";
  if (sector.OverallFastest) return "purple";
  if (sector.PersonalFastest) return "green";
  return "plain";
}

/** seconds === 0 is the session leader (no gap to themselves) - a dash, not "+0.000".
 * undefined means no valid lap yet - also a dash, but must not be confused with the
 * leader case (that distinction lives in the caller, which only calls this once a gap is
 * known to exist). */
function formatGap(seconds: number): string {
  return seconds === 0 ? "-" : `+${seconds.toFixed(3)}`;
}

const TimingTower: React.FC<TimingTowerProps> = ({
  drivers,
  timingAppData,
  timingStats,
  selectedDrivers,
  onToggleDriver,
  battleRadar,
  teamRadioClips,
  isQualifying,
  eliminatedDrivers,
  qualifyingGaps,
}) => {
  const eliminatedSet = new Set(eliminatedDrivers);
  const rows = Object.entries(drivers)
    .map(([driverStr, timing]) => ({ driverNumber: Number(driverStr), timing }))
    .sort((a, b) => {
      const posA = Number(a.timing.Position) || 999;
      const posB = Number(b.timing.Position) || 999;
      return posA - posB;
    });
  const radioClipsByDriver = clipsByDriver(teamRadioClips);

  if (rows.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Waiting for timing data…</div>;
  }

  return (
    <div>
      <div className={`tower-row tower-header${isQualifying ? " qualifying" : ""}`}>
        <span />
        <span />
        <span />
        <span className="gap" title={isQualifying ? "Gap to the session's fastest lap so far" : "Gap to the race leader"}>
          Gap
        </span>
        <span />
        <span />
        <span className="mono" style={{ textAlign: "right" }}>
          {isQualifying ? "Best" : "Last Lap"}
        </span>
        {isQualifying && (
          <>
            <span className="mono" style={{ textAlign: "right" }}>S1</span>
            <span className="mono" style={{ textAlign: "right" }}>S2</span>
            <span className="mono" style={{ textAlign: "right" }}>S3</span>
          </>
        )}
        <span />
        <span className="speed-trap" title="Speed Trap - top speed recorded at the track's speed-trap sensor">
          Speed Trap
        </span>
        <span />
      </div>
      {rows.map(({ driverNumber, timing }) => {
        const roster = getRosterEntry(driverNumber);
        const compounds = compoundHistory(timingAppData[String(driverNumber)]);
        const speedTrap = timingStats[String(driverNumber)]?.BestSpeeds?.ST?.Value;
        const selected = selectedDrivers.includes(driverNumber);
        const displayedLap = isQualifying ? timing.BestLapTime : timing.LastLapTime;
        const sectors = timing.Sectors ?? {};
        // GapToLeader/IntervalToPositionAhead are on-track race concepts F1 never sends
        // during qualifying (confirmed live: 0 occurrences over a full session). F1's own
        // Stats[index].TimeDiffToFastest looked like the qualifying equivalent but proved
        // unreliable two ways (confirmed live): the index isn't fixed (shifts per
        // qualifying part) and it's never zeroed/cleared for a new leader, leaving a stale
        // nonzero gap on the actual P1 driver. qualifyingGaps is computed backend-side
        // from BestLapTime instead - see SessionState._recompute_qualifying_gaps.
        const qualifyingGapSeconds = qualifyingGaps[String(driverNumber)];
        const gap = isQualifying
          ? qualifyingGapSeconds !== undefined
            ? formatGap(qualifyingGapSeconds)
            : undefined
          : timing.GapToLeader;
        const eliminated = isQualifying && eliminatedSet.has(driverNumber);

        return (
          <div
            key={driverNumber}
            className={`tower-row${isQualifying ? " qualifying" : ""}${selected ? " selected" : ""}${eliminated ? " eliminated" : ""}`}
            onClick={() => onToggleDriver(driverNumber)}
            title={eliminated ? "Eliminated - did not advance to the next qualifying segment" : "Click to compare this driver's telemetry"}
          >
            <span className="pos">{timing.Position ?? "-"}</span>
            <span className="team-bar" style={{ background: roster.teamColor }} />
            <span className="drv">
              {roster.tla}
              {eliminated && <span className="out-badge">OUT</span>}
            </span>
            <span className="gap mono">{gap ?? "-"}</span>
            <span className="battle-radar-slot">
              <BattleRadarIndicator alert={battleRadar[String(driverNumber)]} />
            </span>
            <span className="radio-indicator-slot">
              <RadioIndicator clips={radioClipsByDriver[driverNumber] ?? []} />
            </span>
            <span className={`lap mono ${lapTimeClass(displayedLap)}`}>{displayedLap?.Value || "-"}</span>
            {isQualifying && (
              <>
                <span className={`sector mono ${sectorClass(sectors["0"])}`}>{sectors["0"]?.Value || "-"}</span>
                <span className={`sector mono ${sectorClass(sectors["1"])}`}>{sectors["1"]?.Value || "-"}</span>
                <span className={`sector mono ${sectorClass(sectors["2"])}`}>{sectors["2"]?.Value || "-"}</span>
              </>
            )}
            <span className="tyre-history" title={`Tyres used this session: ${compounds.join(", ") || "unknown"}`}>
              {compounds.length > 0 ? (
                compounds.map((compound, i) => (
                  <span
                    key={i}
                    className={`tyre-chip-mini ${compound}${i === compounds.length - 1 ? " current" : ""}`}
                  >
                    {compound !== "unknown" ? compound[0].toUpperCase() : "?"}
                  </span>
                ))
              ) : (
                <span className="tyre-chip-mini unknown">?</span>
              )}
            </span>
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
