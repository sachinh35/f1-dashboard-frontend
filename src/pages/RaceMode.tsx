import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LapDeltaChart from "../components/racemode/LapDeltaChart";
import RaceControlFeed from "../components/racemode/RaceControlFeed";
import SessionClock from "../components/racemode/SessionClock";
import TeamRadioPanel from "../components/racemode/TeamRadioPanel";
import TelemetryLab from "../components/racemode/TelemetryLab";
import TimingTower from "../components/racemode/TimingTower";
import TrackMap from "../components/racemode/TrackMap";
import TrackStatusBanner from "../components/racemode/TrackStatusBanner";
import { clearLiveRoster, rosterEntryFromWire, setLiveRoster } from "../data/driverRoster";
import type { DriverRosterWireEntry } from "../data/driverRoster";
import { connectRaceModeStream } from "../services/sse";
import "../styles/raceMode.css";
import {
  DriverListInfo,
  DriverTiming,
  ExtrapolatedClockData,
  LapCountData,
  PositionSample,
  RaceControlEntry,
  SessionInfoData,
  TelemetrySample,
  TimingAppDataInfo,
  TimingStatsInfo,
  TopThreeInfo,
  TrackStatus,
  Weather,
} from "../types/raceMode";

function applyRosterWire(wire: Record<string, DriverRosterWireEntry>): void {
  setLiveRoster(
    Object.fromEntries(Object.values(wire).map((entry) => [entry.driver_number, rosterEntryFromWire(entry)]))
  );
}

interface SlowState {
  sessionKey: number | null;
  drivers: Record<string, DriverTiming>;
  driverList: Record<string, DriverListInfo>;
  timingAppData: Record<string, TimingAppDataInfo>;
  timingStats: Record<string, TimingStatsInfo>;
  topThree: Record<string, TopThreeInfo>;
  trackStatus: TrackStatus;
  weather: Weather;
  sessionInfo: SessionInfoData;
  lapCount: LapCountData;
  extrapolatedClock: ExtrapolatedClockData;
  raceControlMessages: Record<string, RaceControlEntry>;
}

const INITIAL_STATE: SlowState = {
  sessionKey: null,
  drivers: {},
  driverList: {},
  timingAppData: {},
  timingStats: {},
  topThree: {},
  trackStatus: {},
  weather: {},
  sessionInfo: {},
  lapCount: {},
  extrapolatedClock: {},
  raceControlMessages: {},
};

const RaceMode: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const [state, setState] = useState<SlowState>(INITIAL_STATE);
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  const [radioRefreshSignal, setRadioRefreshSignal] = useState(0);
  const [connected, setConnected] = useState(false);

  // High-frequency telemetry/position bypass React state entirely - Canvas
  // components read these refs directly every animation frame instead.
  const telemetryRef = useRef<Record<string, TelemetrySample>>({});
  const positionsRef = useRef<Record<string, PositionSample>>({});
  // Per-driver position history - draws the track outline itself in TrackMap,
  // since F1's feed never sends circuit geometry (see TrackMap.tsx).
  const trailRef = useRef<Record<string, { x: number; y: number }[]>>({});
  const MAX_TRAIL_POINTS_PER_DRIVER = 2000;

  useEffect(() => {
    if (!streamId) return;

    setState(INITIAL_STATE);
    telemetryRef.current = {};
    positionsRef.current = {};
    trailRef.current = {};
    clearLiveRoster();
    setConnected(true);

    const disconnect = connectRaceModeStream(streamId, {
      snapshot: (snapshot) => {
        setState({
          sessionKey: snapshot.session_key,
          drivers: snapshot.drivers,
          driverList: snapshot.driver_list,
          timingAppData: snapshot.timing_app_data,
          timingStats: snapshot.timing_stats,
          topThree: snapshot.top_three,
          trackStatus: snapshot.track_status,
          weather: snapshot.weather,
          sessionInfo: snapshot.session_info,
          lapCount: snapshot.lap_count,
          extrapolatedClock: snapshot.extrapolated_clock,
          raceControlMessages: snapshot.race_control_messages,
        });
        if (snapshot.driver_roster) applyRosterWire(snapshot.driver_roster);
      },
      driver_roster: (data) => {
        if (data.driver_roster) applyRosterWire(data.driver_roster);
      },
      TimingData: (data) => {
        if (data.drivers) {
          setState((prev) => ({ ...prev, drivers: { ...prev.drivers, ...data.drivers } }));
        }
      },
      DriverList: (data) => {
        if (data.driver_list) {
          setState((prev) => ({ ...prev, driverList: { ...prev.driverList, ...data.driver_list } }));
        }
      },
      TimingAppData: (data) => {
        if (data.timing_app_data) {
          setState((prev) => ({ ...prev, timingAppData: { ...prev.timingAppData, ...data.timing_app_data } }));
        }
      },
      TimingStats: (data) => {
        if (data.timing_stats) {
          setState((prev) => ({ ...prev, timingStats: { ...prev.timingStats, ...data.timing_stats } }));
        }
      },
      TopThree: (data) => {
        if (data.top_three) {
          setState((prev) => ({ ...prev, topThree: { ...prev.topThree, ...data.top_three } }));
        }
      },
      TrackStatus: (data) => {
        if (data.track_status) setState((prev) => ({ ...prev, trackStatus: data.track_status! }));
      },
      WeatherData: (data) => {
        if (data.weather) setState((prev) => ({ ...prev, weather: data.weather! }));
      },
      SessionInfo: (data) => {
        if (data.session_info) {
          setState((prev) => ({
            ...prev,
            sessionInfo: data.session_info!,
            sessionKey: data.session_info!.Key ?? prev.sessionKey,
          }));
        }
      },
      LapCount: (data) => {
        if (data.lap_count) setState((prev) => ({ ...prev, lapCount: data.lap_count! }));
      },
      ExtrapolatedClock: (data) => {
        if (data.extrapolated_clock) setState((prev) => ({ ...prev, extrapolatedClock: data.extrapolated_clock! }));
      },
      RaceControlMessages: (data) => {
        if (data.race_control_messages) {
          setState((prev) => ({
            ...prev,
            raceControlMessages: { ...prev.raceControlMessages, ...data.race_control_messages },
          }));
        }
      },
      "CarData.z": (data) => {
        if (data.telemetry) {
          telemetryRef.current = { ...telemetryRef.current, ...data.telemetry };
        }
      },
      "Position.z": (data) => {
        if (data.positions) {
          positionsRef.current = { ...positionsRef.current, ...data.positions };
          for (const [driverStr, pos] of Object.entries(data.positions)) {
            const trail = trailRef.current[driverStr] ?? (trailRef.current[driverStr] = []);
            trail.push({ x: pos.x, y: pos.y });
            if (trail.length > MAX_TRAIL_POINTS_PER_DRIVER) trail.shift();
          }
        }
      },
      RADIO_CLIP_READY: () => setRadioRefreshSignal((n) => n + 1),
      RADIO_TRANSCRIPT_READY: () => setRadioRefreshSignal((n) => n + 1),
    });

    return () => {
      disconnect();
      setConnected(false);
    };
  }, [streamId]);

  const toggleDriver = (driverNumber: number) => {
    setSelectedDrivers((prev) => {
      if (prev.includes(driverNumber)) return prev.filter((d) => d !== driverNumber);
      if (prev.length >= 4) return [...prev.slice(1), driverNumber];
      return [...prev, driverNumber];
    });
  };

  const meetingName = state.sessionInfo.Meeting?.Name;

  return (
    <div className="race-mode">
      <div className="rm-header">
        <h1>
          <span className="display">Race Mode</span>
          {connected && <span className="rm-live-pill">LIVE</span>}
          {meetingName && (
            <span style={{ color: "var(--text-lo)", fontSize: 15, fontWeight: 400 }}>{meetingName}</span>
          )}
        </h1>
        <Link to="/" className="rm-back-link">
          &larr; Back to Garage
        </Link>
      </div>

      <div className="rm-grid">
        <div className="rm-panel" style={{ gridColumn: 1, gridRow: "1 / 3" }}>
          <div className="rm-panel-label">
            <span>Timing Tower</span>
          </div>
          <SessionClock lapCount={state.lapCount} extrapolatedClock={state.extrapolatedClock} />
          <div style={{ height: 14 }} />
          <TimingTower
            drivers={state.drivers}
            timingAppData={state.timingAppData}
            timingStats={state.timingStats}
            selectedDrivers={selectedDrivers}
            onToggleDriver={toggleDriver}
          />
        </div>

        <div className="rm-panel">
          <div className="rm-panel-label">Track Map</div>
          <TrackMap positionsRef={positionsRef} trailRef={trailRef} selectedDrivers={selectedDrivers} />
        </div>

        <div className="rm-panel">
          <div className="rm-panel-label">Track Status &amp; Weather</div>
          <TrackStatusBanner trackStatus={state.trackStatus} weather={state.weather} />
        </div>

        <div className="rm-panel">
          <div className="rm-panel-label">Telemetry Compare</div>
          <TelemetryLab telemetryRef={telemetryRef} selectedDrivers={selectedDrivers} />
        </div>

        <div className="rm-panel">
          <div className="rm-panel-label">Team Radio</div>
          <TeamRadioPanel sessionKey={state.sessionKey} refreshSignal={radioRefreshSignal} />
        </div>

        <div className="rm-panel rm-span-2">
          <div className="rm-panel-label">Lap Delta &amp; Corner Analysis</div>
          <LapDeltaChart sessionKey={state.sessionKey} selectedDrivers={selectedDrivers} drivers={state.drivers} />
        </div>

        <div className="rm-panel rm-span-2">
          <div className="rm-panel-label">Race Control</div>
          <RaceControlFeed messages={state.raceControlMessages} />
        </div>
      </div>
    </div>
  );
};

export default RaceMode;
