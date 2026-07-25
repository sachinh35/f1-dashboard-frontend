/**
 * Types for the Race Mode live view.
 *
 * These mirror the *resolved* wire format the backend's diff_to_wire()
 * (utils/live_session_pipeline.py) actually sends over SSE - already-merged
 * current state for whatever changed, not a raw diff. Frontend "merging" is
 * therefore just a shallow per-driver overwrite, never a deep merge - the
 * backend already did that work.
 */
import type { DriverRosterWireEntry } from "../data/driverRoster";

export interface DriverTiming {
  Position?: string;
  GapToLeader?: string;
  IntervalToPositionAhead?: { Value?: string };
  NumberOfLaps?: number;
  LastLapTime?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean };
  BestLapTime?: { Value?: string; Lap?: number };
  Sectors?: Record<string, { Value?: string; Segments?: Record<string, { Status?: number }> }>;
  Speeds?: Record<string, { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean }>;
  InPit?: boolean;
  PitOut?: boolean;
  NumberOfPitStops?: number;
  Retired?: boolean;
  Stopped?: boolean;
  Line?: number;
}

export interface DriverListInfo {
  Line?: number;
}

export interface StintInfo {
  Compound?: string;
  TotalLaps?: number;
  New?: string;
}

export interface TimingAppDataInfo {
  Stints?: Record<string, StintInfo>;
  GridPos?: string;
}

export interface TimingStatsInfo {
  BestSpeeds?: Record<string, { Position?: number; Value?: string }>;
  PersonalBestLapTime?: { Value?: string };
}

export interface TopThreeInfo {
  DiffToLeader?: string;
}

export interface TrackStatus {
  Status?: string;
  Message?: string;
}

export interface Weather {
  AirTemp?: string;
  TrackTemp?: string;
  Humidity?: string;
  Pressure?: string;
  Rainfall?: string;
  WindSpeed?: string;
  WindDirection?: string;
}

export interface SessionInfoData {
  Meeting?: { Key?: number; Name?: string; Location?: string; Country?: { Name?: string } };
  Key?: number;
  Type?: string;
  Name?: string;
}

export interface LapCountData {
  CurrentLap?: number;
  TotalLaps?: number;
}

export interface ExtrapolatedClockData {
  Remaining?: string;
  Extrapolating?: boolean;
}

export interface RaceControlEntry {
  Utc?: string;
  Lap?: number;
  Category?: string;
  Message?: string;
  Flag?: string;
  Status?: string;
  Scope?: string;
  RacingNumber?: string;
}

export interface TelemetrySample {
  speed_kmh: number;
  rpm: number;
  gear: number;
  throttle_pct: number;
  brake_pct: number;
  drs: number;
}

export interface PositionSample {
  x: number;
  y: number;
  z: number;
  status: string;
}

export interface CompletedLapWire {
  driver_number: number;
  lap_number: number;
  lap_duration_seconds: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  avg_throttle_pct: number | null;
  drs_active_pct: number | null;
}

export interface NewRadioCaptureWire {
  driver_number: number;
  lap_number: number | null;
  utc: string;
}

export type RadioClipStatus =
  | "pending"
  | "downloading"
  | "downloaded"
  | "transcribing"
  | "done"
  | "failed_download"
  | "failed_transcription";

export interface TeamRadioClip {
  id: number;
  session_key: number;
  driver_number: number;
  lap_number: number | null;
  ts: string;
  audio_path: string | null;
  transcript: string | null;
  status: RadioClipStatus;
  error: string | null;
  transcribed_at: string | null;
}

export interface LapTraceData {
  driver_number: number;
  lap_number: number;
  distance_m: number[];
  speed_kmh: number[];
  throttle_pct: number[];
  brake_pct: number[];
  acceleration_ms2: number[];
}

export interface CornerData {
  distance_m: number;
  apex_speed_kmh: number;
}

export interface DeltaTraceData {
  distance_m: number[];
  delta_seconds: number[];
  corners: CornerData[];
}

export interface LapComparisonData {
  session_key: number;
  driver_a: LapTraceData;
  driver_b: LapTraceData;
  delta: DeltaTraceData;
}

/** The full-state payload sent as the SSE "snapshot" event, matching SessionState.snapshot(). */
export interface RaceModeSnapshot {
  session_key: number | null;
  drivers: Record<string, DriverTiming>;
  driver_list: Record<string, DriverListInfo>;
  timing_app_data: Record<string, TimingAppDataInfo>;
  timing_stats: Record<string, TimingStatsInfo>;
  top_three: Record<string, TopThreeInfo>;
  track_status: TrackStatus;
  weather: Weather;
  session_info: SessionInfoData;
  session_data: Record<string, unknown>;
  session_status: Record<string, unknown>;
  lap_count: LapCountData;
  extrapolated_clock: ExtrapolatedClockData;
  race_control_messages: Record<string, RaceControlEntry>;
  driver_roster: Record<string, DriverRosterWireEntry>;
}
