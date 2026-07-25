import React from "react";
import { getRosterEntry } from "../../data/driverRoster";
import { TeamRadioClip } from "../../types/raceMode";

interface NotableRadioWidgetProps {
  clips: TeamRadioClip[];
}

const NotableRadioWidget: React.FC<NotableRadioWidgetProps> = ({ clips }) => {
  const notable = clips
    .filter((clip) => clip.is_notable === true)
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (notable.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No notable radio yet.</div>;
  }

  return (
    <div className="notable-radio-list">
      {notable.map((clip) => {
        const roster = getRosterEntry(clip.driver_number);

        return (
          <div key={clip.id} className="notable-radio-item">
            <div className="notable-radio-head">
              <span className="radio-driver" style={{ color: roster.teamColor }}>
                {roster.tla}
              </span>
              {clip.lap_number != null && <span className="radio-lap">LAP {clip.lap_number}</span>}
            </div>
            {clip.transcript && <div className="radio-transcript">&ldquo;{clip.transcript}&rdquo;</div>}
            {clip.notable_reason && <div className="notable-radio-reason">{clip.notable_reason}</div>}
          </div>
        );
      })}
    </div>
  );
};

export default NotableRadioWidget;
