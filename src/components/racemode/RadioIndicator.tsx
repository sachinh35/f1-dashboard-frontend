import React, { useState } from "react";
import { TeamRadioClip } from "../../types/raceMode";

interface RadioIndicatorProps {
  clip: TeamRadioClip | undefined;
}

const RadioIndicator: React.FC<RadioIndicatorProps> = ({ clip }) => {
  const [open, setOpen] = useState(false);

  if (!clip || !clip.transcript) return null;

  const notable = clip.is_notable === true;

  return (
    <span
      className={`radio-indicator-badge${notable ? " radio-indicator-notable" : ""}`}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      title={notable ? "Notable team radio" : "Team radio"}
    >
      ((•))
      {open && (
        <span className="radio-indicator-popover">
          {clip.lap_number != null && <span className="radio-indicator-popover-lap">LAP {clip.lap_number}</span>}
          <span className="radio-indicator-popover-transcript">&ldquo;{clip.transcript}&rdquo;</span>
          {notable && clip.notable_reason && (
            <span className="radio-indicator-popover-reason">{clip.notable_reason}</span>
          )}
        </span>
      )}
    </span>
  );
};

export default RadioIndicator;
