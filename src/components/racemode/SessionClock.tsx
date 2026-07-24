import React, { useEffect, useRef, useState } from "react";
import { ExtrapolatedClockData, LapCountData } from "../../types/raceMode";

interface SessionClockProps {
  lapCount: LapCountData;
  extrapolatedClock: ExtrapolatedClockData;
}

/** Parse F1's "H:MM:SS" (or "MM:SS") remaining-time string into total seconds. */
function parseHms(value: string): number | null {
  const parts = value.split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function formatHms(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * F1's ExtrapolatedClock topic is sent rarely - observed exactly once in a
 * full captured race - and carries `Extrapolating: true` as an explicit
 * instruction that the client should keep counting the clock down locally
 * between updates, not wait for the server to send fresh values. This
 * anchors on each new value received and ticks it down with a local
 * interval, re-anchoring whenever a fresher value arrives.
 */
const SessionClock: React.FC<SessionClockProps> = ({ lapCount, extrapolatedClock }) => {
  const [displayedRemaining, setDisplayedRemaining] = useState<string>("--:--:--");
  const anchorRef = useRef<{ seconds: number; receivedAtMs: number } | null>(null);

  useEffect(() => {
    if (!extrapolatedClock.Remaining) return;
    const seconds = parseHms(extrapolatedClock.Remaining);
    if (seconds == null) return;
    anchorRef.current = { seconds, receivedAtMs: Date.now() };
    setDisplayedRemaining(formatHms(seconds));
  }, [extrapolatedClock.Remaining]);

  useEffect(() => {
    if (!extrapolatedClock.Extrapolating) return;
    const interval = setInterval(() => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const elapsedSeconds = (Date.now() - anchor.receivedAtMs) / 1000;
      setDisplayedRemaining(formatHms(anchor.seconds - elapsedSeconds));
    }, 1000);
    return () => clearInterval(interval);
  }, [extrapolatedClock.Extrapolating]);

  return (
    <div className="rm-clock">
      <div>
        <div className="big mono">
          {lapCount.CurrentLap ?? "-"}
          {lapCount.TotalLaps ? ` / ${lapCount.TotalLaps}` : ""}
        </div>
        <div className="lbl">Lap</div>
      </div>
      <div>
        <div className="big mono">{displayedRemaining}</div>
        <div className="lbl">Remaining</div>
      </div>
    </div>
  );
};

export default SessionClock;
