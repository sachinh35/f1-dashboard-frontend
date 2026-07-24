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

function formatTime(utc?: string): string {
  if (!utc) return "";
  const match = utc.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : utc;
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
