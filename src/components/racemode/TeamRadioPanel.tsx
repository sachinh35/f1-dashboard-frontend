import React from "react";
import { getRosterEntry } from "../../data/driverRoster";
import { TeamRadioClip } from "../../types/raceMode";

interface TeamRadioPanelProps {
  clips: TeamRadioClip[];
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

/** Chat alignment bucket. "unclear" and not-yet-analyzed (null, before Gemini analysis has run)
 * both fall back to the centered/neutral layout - we shouldn't guess a side for something the
 * classifier itself wasn't sure about, or for a clip that hasn't been classified yet. */
function alignmentClass(speakerRole: TeamRadioClip["speaker_role"]): string {
  if (speakerRole === "pit_wall") return "radio-msg-pit_wall";
  if (speakerRole === "driver") return "radio-msg-driver";
  return "radio-msg-unclear";
}

const TeamRadioPanel: React.FC<TeamRadioPanelProps> = ({ clips }) => {
  const sorted = [...clips].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (sorted.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No team radio yet.</div>;
  }

  return (
    <div className="radio-chat">
      {sorted.map((clip) => {
        const roster = getRosterEntry(clip.driver_number);
        const playable =
          Boolean(clip.audio_path) &&
          clip.status !== "pending" &&
          clip.status !== "downloading" &&
          clip.status !== "failed_download";
        const notable = clip.is_notable === true;

        return (
          <div
            key={clip.id}
            className={`radio-msg ${alignmentClass(clip.speaker_role)}${notable ? " radio-msg-notable" : ""}`}
          >
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
              {notable && <span className="radio-notable-tag">● Notable</span>}
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
