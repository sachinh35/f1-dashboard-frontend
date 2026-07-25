import React from "react";
import { RaceControlEntry } from "../../types/raceMode";

interface RaceControlFeedProps {
  messages: Record<string, RaceControlEntry>;
}

function categoryClass(category?: string): string {
  if (category === "Drs") return "cat-drs";
  if (category === "Flag") return "cat-flag";
  return "cat-other";
}

/** F1's RaceControlMessages Utc field carries no 'Z'/offset suffix (e.g. "2025-11-30T15:57:04")
 * but is always UTC - append 'Z' when it's missing so the Date is parsed as UTC, not as local
 * time (which is what a bare offset-less ISO string means per spec), then render it in the
 * browser's own local time zone. Previously this just regex-extracted the raw UTC HH:MM
 * substring and displayed it as-is, silently showing UTC time as if it were local. */
function formatTime(utc?: string): string {
  if (!utc) return "";
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(utc) ? utc : `${utc}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return utc;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

const RaceControlFeed: React.FC<RaceControlFeedProps> = ({ messages }) => {
  const entries = Object.entries(messages)
    .map(([index, entry]) => ({ index: Number(index), entry }))
    .sort((a, b) => b.index - a.index)
    .slice(0, 40);

  if (entries.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No race control messages yet.</div>;
  }

  return (
    <div>
      {entries.map(({ index, entry }) => (
        <div key={index} className="rc-item">
          <span className="t mono">{formatTime(entry.Utc)}</span>
          <span className={`cat ${categoryClass(entry.Category)}`}>{entry.Category ?? "Info"}</span>
          <span className="m">{entry.Message ?? entry.Status ?? ""}</span>
        </div>
      ))}
    </div>
  );
};

export default RaceControlFeed;
