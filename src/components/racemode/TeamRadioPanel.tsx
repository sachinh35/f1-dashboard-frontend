import React, { useCallback, useEffect, useState } from "react";
import { getRosterEntry } from "../../data/driverRoster";
import { getTeamRadioForSession } from "../../services/api";
import { TeamRadioClip } from "../../types/raceMode";

interface TeamRadioPanelProps {
  sessionKey: number | null;
  /** Bumped by the parent whenever a RADIO_CLIP_READY/RADIO_TRANSCRIPT_READY SSE event arrives, to trigger a refetch. */
  refreshSignal: number;
}

const AUDIO_BASE_URL = "http://localhost:8000/audio";

function formatStatus(status: TeamRadioClip["status"]): string {
  switch (status) {
    case "pending":
      return "Incoming…";
    case "downloading":
      return "Downloading…";
    case "downloaded":
      return "Playable — transcribing…";
    case "transcribing":
      return "Transcribing…";
    case "failed_download":
      return "Download failed";
    case "failed_transcription":
      return "Transcription failed (still playable)";
    default:
      return "";
  }
}

const TeamRadioPanel: React.FC<TeamRadioPanelProps> = ({ sessionKey, refreshSignal }) => {
  const [clips, setClips] = useState<TeamRadioClip[]>([]);

  const refresh = useCallback(async () => {
    if (sessionKey == null) return;
    try {
      const data = await getTeamRadioForSession(sessionKey);
      setClips(data);
    } catch (err) {
      console.error("Failed to fetch team radio", err);
    }
  }, [sessionKey]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshSignal]);

  const sorted = [...clips].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (sorted.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No team radio yet.</div>;
  }

  return (
    <div>
      {sorted.map((clip) => {
        const roster = getRosterEntry(clip.driver_number);
        const playable = Boolean(clip.audio_path) && clip.status !== "pending" && clip.status !== "downloading" && clip.status !== "failed_download";

        return (
          <div key={clip.id} className="radio-item">
            <div className="radio-item-head">
              <button
                className="radio-play-btn"
                disabled={!playable}
                onClick={() => {
                  if (clip.audio_path) {
                    new Audio(`${AUDIO_BASE_URL}/${clip.audio_path}`).play().catch((err) => console.error(err));
                  }
                }}
              >
                ▶
              </button>
              <span className="radio-driver" style={{ color: roster.teamColor }}>
                {roster.tla}
              </span>
              {clip.lap_number != null && <span className="radio-lap">LAP {clip.lap_number}</span>}
            </div>
            {clip.transcript ? (
              <div className="radio-transcript">&ldquo;{clip.transcript}&rdquo;</div>
            ) : (
              <div className="radio-status">{formatStatus(clip.status)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TeamRadioPanel;
