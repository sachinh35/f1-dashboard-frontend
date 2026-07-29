/**
 * Shared types/helpers for the driver-comparison widgets (CompareWidget.tsx) in Race Mode.
 *
 * Two fundamentally different data shapes flow through these widgets:
 *  - "continuous" metrics (speed/throttle/brake) are read live off telemetryRef every
 *    animation frame - see CompareWidget.tsx, same approach the old TelemetryLab used.
 *  - "discrete" metrics (sector1/2/3, lapTime) only produce a new definitive value once
 *    per lap (or per sector) per driver, sourced from TimingData rather than CarData.z.
 *    These are accumulated over the session into a per-metric, per-driver lap history
 *    (see RaceMode.tsx's TimingData handler and upsertLapMetricPoint below).
 */

export type DiscreteCompareMetric = "sector1" | "sector2" | "sector3" | "lapTime";
export type CompareMetric = DiscreteCompareMetric | "speed" | "throttle" | "brake";

/** Dropdown order, matching the order requested for the metric picker. */
export const COMPARE_METRICS: CompareMetric[] = [
  "speed",
  "throttle",
  "brake",
  "sector1",
  "sector2",
  "sector3",
  "lapTime",
];

export const COMPARE_METRIC_LABELS: Record<CompareMetric, string> = {
  speed: "Speed",
  throttle: "Throttle",
  brake: "Brake",
  sector1: "Sector 1",
  sector2: "Sector 2",
  sector3: "Sector 3",
  lapTime: "Lap Time",
};

export function isDiscreteMetric(metric: CompareMetric): metric is DiscreteCompareMetric {
  return metric === "sector1" || metric === "sector2" || metric === "sector3" || metric === "lapTime";
}

/**
 * Which key of DriverTiming.Sectors ("0"/"1"/"2") a discrete metric reads from - null for
 * lapTime, which reads DriverTiming.LastLapTime instead.
 */
export function sectorIndexForMetric(metric: DiscreteCompareMetric): string | null {
  switch (metric) {
    case "sector1":
      return "0";
    case "sector2":
      return "1";
    case "sector3":
      return "2";
    case "lapTime":
      return null;
  }
}

/**
 * Parses an F1 timing string into plain seconds. Handles both lap-time format
 * ("M:SS.mmm", e.g. "1:24.840" -> 84.84) and sector format ("SS.mmm", e.g. "28.924" ->
 * 28.924). Returns null for empty/undefined/unparseable input (F1 sends "" for a sector/lap
 * that hasn't completed yet this lap). There is no existing string->seconds parser in
 * formatting.ts (only the reverse direction) - this is the new one.
 */
export function parseTimeToSeconds(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const minutesPart = trimmed.slice(0, colonIndex);
  const secondsPart = trimmed.slice(colonIndex + 1);
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

export interface LapMetricPoint {
  lap: number;
  value: number;
}

/**
 * Upserts a { lap, value } point into a driver's lap-metric history, keyed by lap number -
 * a later update for the same lap replaces that lap's value in place rather than appending
 * a duplicate. Mutates `history` in place (matches the ref-mutation style telemetryRef/
 * trailRef already use elsewhere in this codebase, deliberately, for the same performance
 * reason - this can be called many times per second across ~20 drivers during a fast
 * replay). Keeps each driver's array sorted ascending by lap even if messages arrive
 * slightly out of order.
 */
export function upsertLapMetricPoint(
  history: Record<number, LapMetricPoint[]>,
  driverNumber: number,
  lap: number,
  value: number
): void {
  const points = history[driverNumber] ?? (history[driverNumber] = []);

  const existing = points.find((p) => p.lap === lap);
  if (existing) {
    existing.value = value;
    return;
  }

  let insertAt = points.length;
  for (let i = 0; i < points.length; i++) {
    if (points[i].lap > lap) {
      insertAt = i;
      break;
    }
  }
  points.splice(insertAt, 0, { lap, value });
}

/**
 * A notable per-driver moment surfaced as a marker on the Telemetry Compare charts - a pit
 * stop, a tyre change, or a stewards' penalty. Three different upstream sources
 * (DriverTiming.NumberOfPitStops, TimingAppDataInfo.Stints, RaceControlEntry) all normalize
 * down to this one shape (see RaceMode.tsx's driverEventsRef) so CompareWidget only needs a
 * single prop/rendering path instead of three.
 */
export type DriverEventKind = "pit" | "tyre" | "penalty";

export interface DriverEventMarker {
  lap: number;
  kind: DriverEventKind;
  label: string;
  /** Only present for "tyre" events - the new stint's compound, lowercased (e.g. "medium"),
   * so the marker can optionally be tinted to match the tyre-chip-mini/tyre-stint-segment
   * compound palette already established elsewhere in this file, rather than a single flat
   * tyre color. */
  compound?: string;
}

/**
 * Appends a driver event marker, deduping identical (lap, kind, label) triples in place.
 * TimingData/TimingAppData resend the full current resolved state on every message (even for
 * unrelated field changes) - callers must only invoke this on a genuine transition (e.g. a
 * pit-stop count that just increased), but this is a defensive backstop against the same
 * transition ever being detected and appended twice. Mutates `events` in place - same
 * ref-mutation convention as upsertLapMetricPoint above.
 */
export function addDriverEvent(
  events: Record<number, DriverEventMarker[]>,
  driverNumber: number,
  event: DriverEventMarker
): void {
  const list = events[driverNumber] ?? (events[driverNumber] = []);
  const isDuplicate = list.some((e) => e.lap === event.lap && e.kind === event.kind && e.label === event.label);
  if (isDuplicate) return;
  list.push(event);
}

/**
 * Which lap numbers a driver pitted on, per their recorded pit-stop events - a pit in/out lap
 * commonly spikes that lap's sector/lap time well above normal racing pace (pit lane speed
 * limits, the stop itself), which would otherwise drag a comparison chart's whole Y-axis
 * scale out to fit one outlier lap and flatten everyone else's detail. Used to exclude those
 * laps from axis auto-scaling (see CompareWidget.tsx's computeLapValueBounds) while still
 * plotting the point itself, clamped, rather than hiding it.
 */
export function pitAffectedLaps(events: DriverEventMarker[] | undefined): Set<number> {
  const laps = new Set<number>();
  if (!events) return laps;
  for (const event of events) {
    if (event.kind === "pit") laps.add(event.lap);
  }
  return laps;
}

/**
 * Formats a discrete metric's parsed-seconds value back into F1's own display convention -
 * lap times as "M:SS.mmm" (e.g. 84.84 -> "1:24.840"), sector times as plain "SS.mmm" (F1's
 * raw feed never prefixes a sector time with minutes) - used in each data point's hover
 * tooltip, not just the raw seconds float.
 */
export function formatMetricValue(metric: DiscreteCompareMetric, seconds: number): string {
  if (metric === "lapTime") {
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${minutes}:${secs.padStart(6, "0")}`;
  }
  return seconds.toFixed(3);
}

export function formatPitStopLabel(lap: number): string {
  return `Pit stop (lap ${lap})`;
}

/** "MEDIUM" -> "Medium" - F1 sends tyre compounds fully upper-cased over the wire. */
export function titleCaseCompound(compound: string): string {
  if (!compound) return compound;
  return compound.charAt(0).toUpperCase() + compound.slice(1).toLowerCase();
}

export function formatTyreChangeLabel(compound: string, lap: number): string {
  return `Pitted for ${titleCaseCompound(compound)} (lap ${lap})`;
}

const PENALTY_KEYWORD_REGEX = /penalty/i;
const CAR_NUMBER_REGEX = /CAR (\d+)/i;
const MAX_PENALTY_LABEL_LENGTH = 100;

/**
 * Race control messages carry no structured "type" field - a penalty is identified purely by
 * its free-text Message containing "penalty" (case-insensitive), matching how the FIA
 * actually phrases these, e.g. "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 55 (SAI) -
 * CAUSING A COLLISION (15:57:04)".
 */
export function isPenaltyMessage(message: string): boolean {
  return PENALTY_KEYWORD_REGEX.test(message);
}

/**
 * Extracts the driver/car number a penalty message refers to. RaceControlEntry.RacingNumber
 * is NOT populated on penalty messages (confirmed against real captured race control data -
 * it IS populated on other message types, e.g. flags), so the driver has to be parsed out of
 * the message text itself via the "CAR (\d+)" pattern FIA penalty messages always use.
 * Returns null if no car number can be found, since an event that can't be attributed to a
 * driver can't be drawn on a per-driver comparison chart.
 */
export function extractPenaltyDriverNumber(message: string): number | null {
  const match = message.match(CAR_NUMBER_REGEX);
  if (!match) return null;
  const driverNumber = Number(match[1]);
  return Number.isFinite(driverNumber) ? driverNumber : null;
}

/**
 * Keeps the marker's hover tooltip readable rather than dumping an entire, sometimes very
 * long, race control message verbatim.
 */
export function formatPenaltyLabel(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= MAX_PENALTY_LABEL_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_PENALTY_LABEL_LENGTH - 1)}…`;
}
