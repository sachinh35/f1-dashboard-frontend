import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { getTeamRadioForSession } from "../services/api";
import { connectRaceModeStream } from "../services/sse";
import "../styles/raceMode.css";
import {
  BattleRadarAlert,
  DriverListInfo,
  DriverTiming,
  ExtrapolatedClockData,
  LapCountData,
  PositionSample,
  RaceControlEntry,
  SessionInfoData,
  TeamRadioClip,
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
  battleRadar: Record<string, BattleRadarAlert>;
  qualifyingPart: string | null;
  eliminatedDrivers: number[];
  qualifyingGaps: Record<string, number>;
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
  battleRadar: {},
  qualifyingPart: null,
  eliminatedDrivers: [],
  qualifyingGaps: {},
};

const RaceMode: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const [state, setState] = useState<SlowState>(INITIAL_STATE);
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  const [radioRefreshSignal, setRadioRefreshSignal] = useState(0);
  const [teamRadioClips, setTeamRadioClips] = useState<TeamRadioClip[]>([]);
  const [connected, setConnected] = useState(false);
  // Pins the right-column panel rail's height to the Timing Tower panel's actual rendered
  // height (see the .rm-right-rail div below), so Team Radio scrolls internally instead of
  // growing to fit every message. Plain CSS (grid stretch + flex:1/min-height:0) can't do
  // this: a grid track's "auto" height is computed from the *max-content* size of every
  // item spanning it, including a flex child's full, uncollapsed message-list height -
  // min-height:0 only lets a flex item shrink once its container already has a definite
  // size, so it can't break this circularity on its own. Measuring the tower directly and
  // applying that as an explicit height sidesteps the auto-sizing pass entirely.
  const timingTowerPanelRef = useRef<HTMLDivElement | null>(null);
  const [timingTowerHeight, setTimingTowerHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = timingTowerPanelRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setTimingTowerHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Whether any Position.z/CarData.z has actually been received this session - gates the
  // Track Map / Telemetry Compare / Lap Delta widgets. Not assumed from session type: F1
  // sometimes doesn't send these topics at all for a given live connection (confirmed
  // against a real session, quali and race captures both had them historically), so this
  // self-heals whenever that's resolved rather than hardcoding it off for qualifying.
  const [hasPositionData, setHasPositionData] = useState(false);
  const [hasTelemetryData, setHasTelemetryData] = useState(false);

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
    setTeamRadioClips([]);
    setConnected(true);
    setHasPositionData(false);
    setHasTelemetryData(false);

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
          battleRadar: snapshot.battle_radar ?? {},
          qualifyingPart: snapshot.qualifying_part,
          eliminatedDrivers: snapshot.eliminated_drivers ?? [],
          qualifyingGaps: snapshot.qualifying_gaps ?? {},
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
        if (data.qualifying_gaps) {
          // Full table every time (see sse.ts) - a straight replace, not a merge, so a
          // driver who lost their only valid lap (deleted) correctly drops out instead of
          // keeping a stale entry.
          setState((prev) => ({ ...prev, qualifyingGaps: data.qualifying_gaps! }));
        }
        if (data.battle_radar) {
          const updates = data.battle_radar;
          setState((prev) => {
            const battleRadar = { ...prev.battleRadar };
            for (const [driverStr, alert] of Object.entries(updates)) {
              if (alert) battleRadar[driverStr] = alert;
              else delete battleRadar[driverStr];
            }
            return { ...prev, battleRadar };
          });
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
        setState((prev) => ({
          ...prev,
          sessionInfo: data.session_info ?? prev.sessionInfo,
          sessionKey: data.session_info?.Key ?? prev.sessionKey,
          // qualifying_part can default to "Q1" right here (F1 never announces Q1
          // explicitly) - see sse.ts/SessionState._apply_session_info.
          qualifyingPart: data.qualifying_part !== undefined ? data.qualifying_part ?? null : prev.qualifyingPart,
          eliminatedDrivers: data.eliminated_drivers ?? prev.eliminatedDrivers,
        }));
      },
      SessionData: (data) => {
        setState((prev) => ({
          ...prev,
          qualifyingPart: data.qualifying_part !== undefined ? data.qualifying_part ?? null : prev.qualifyingPart,
          eliminatedDrivers: data.eliminated_drivers ?? prev.eliminatedDrivers,
        }));
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
          setHasTelemetryData(true);
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
          setHasPositionData(true);
        }
      },
      RADIO_CLIP_READY: () => setRadioRefreshSignal((n) => n + 1),
      RADIO_TRANSCRIPT_READY: () => setRadioRefreshSignal((n) => n + 1),
      RADIO_ANALYSIS_READY: () => setRadioRefreshSignal((n) => n + 1),
    });

    return () => {
      disconnect();
      setConnected(false);
    };
  }, [streamId]);

  // Lifted up (rather than fetched privately inside TeamRadioPanel, as it originally was)
  // so TimingTower's per-row radio indicator and TeamRadioPanel can share the exact
  // same data instead of each running their own fetch against the same endpoint.
  const sessionKey = state.sessionKey;
  const refetchTeamRadio = useCallback(async () => {
    if (sessionKey == null) return;
    try {
      setTeamRadioClips(await getTeamRadioForSession(sessionKey));
    } catch (err) {
      console.error("Failed to fetch team radio", err);
    }
  }, [sessionKey]);

  useEffect(() => {
    refetchTeamRadio();
  }, [refetchTeamRadio, radioRefreshSignal]);

  const toggleDriver = (driverNumber: number) => {
    setSelectedDrivers((prev) => {
      if (prev.includes(driverNumber)) return prev.filter((d) => d !== driverNumber);
      if (prev.length >= 4) return [...prev.slice(1), driverNumber];
      return [...prev, driverNumber];
    });
  };

  const meetingName = state.sessionInfo.Meeting?.Name;
  const sessionType = state.sessionInfo.Type;
  const isQualifying = sessionType === "Qualifying";

  return (
    <div className="race-mode">
      <div className="rm-header">
        <h1>
          <span className="display">Race Mode</span>
          {connected && <span className="rm-live-pill">LIVE</span>}
          {isQualifying && (
            <span className="rm-session-pill qualifying">
              QUALIFYING{state.qualifyingPart ? ` – ${state.qualifyingPart}` : ""}
            </span>
          )}
          {meetingName && (
            <span style={{ color: "var(--text-lo)", fontSize: 15, fontWeight: 400 }}>{meetingName}</span>
          )}
        </h1>
        <Link to="/" className="rm-back-link">
          &larr; Back to Garage
        </Link>
      </div>

      <div className="rm-grid">
        <div className="rm-panel" ref={timingTowerPanelRef}>
          <div className="rm-panel-label">
            <span>Timing Tower</span>
          </div>
          <SessionClock
            lapCount={state.lapCount}
            extrapolatedClock={state.extrapolatedClock}
            isQualifying={isQualifying}
            qualifyingPart={state.qualifyingPart}
          />
          <div style={{ height: 14 }} />
          <TimingTower
            drivers={state.drivers}
            timingAppData={state.timingAppData}
            timingStats={state.timingStats}
            battleRadar={state.battleRadar}
            teamRadioClips={teamRadioClips}
            selectedDrivers={selectedDrivers}
            onToggleDriver={toggleDriver}
            isQualifying={isQualifying}
            eliminatedDrivers={state.eliminatedDrivers}
            qualifyingGaps={state.qualifyingGaps}
          />
        </div>

        {/* Bundled into one flex-column rail, pinned via ResizeObserver (see
            timingTowerHeight above) to exactly the Timing Tower panel's rendered height -
            a CSS-only grid-stretch approach can't do this (see the comment on
            timingTowerHeight for why). Track Map/Track Status/Telemetry Compare keep their
            natural height; Team Radio (.rm-panel-fill) is the one item that flexes to
            absorb whatever height is left over, scrolling internally instead of pushing
            the rail past the tower's bottom edge. */}
        <div className="rm-right-rail" style={{ height: timingTowerHeight ?? undefined }}>
          {hasPositionData && (
            <div className="rm-panel">
              <div className="rm-panel-label">Track Map</div>
              <TrackMap positionsRef={positionsRef} trailRef={trailRef} selectedDrivers={selectedDrivers} />
            </div>
          )}

          <div className="rm-panel">
            <div className="rm-panel-label">Track Status &amp; Weather</div>
            <TrackStatusBanner trackStatus={state.trackStatus} weather={state.weather} />
          </div>

          {hasTelemetryData && (
            <div className="rm-panel">
              <div className="rm-panel-label">Telemetry Compare</div>
              <TelemetryLab telemetryRef={telemetryRef} selectedDrivers={selectedDrivers} />
            </div>
          )}

          <div className="rm-panel rm-panel-fill">
            <div className="rm-panel-label">Team Radio</div>
            <TeamRadioPanel clips={teamRadioClips} />
          </div>
        </div>

        {hasTelemetryData && hasPositionData && (
          <div className="rm-panel rm-span-2">
            <div className="rm-panel-label">Lap Delta &amp; Corner Analysis</div>
            <LapDeltaChart sessionKey={state.sessionKey} selectedDrivers={selectedDrivers} drivers={state.drivers} />
          </div>
        )}

        <div className="rm-panel rm-span-2">
          <div className="rm-panel-label">Race Control</div>
          <RaceControlFeed messages={state.raceControlMessages} />
        </div>
      </div>
    </div>
  );
};

export default RaceMode;
