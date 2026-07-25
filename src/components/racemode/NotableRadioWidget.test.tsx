import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotableRadioWidget from "./NotableRadioWidget";
import { TeamRadioClip } from "../../types/raceMode";

function makeClip(overrides: Partial<TeamRadioClip>): TeamRadioClip {
  return {
    id: 1,
    session_key: 9001,
    driver_number: 3,
    lap_number: 12,
    ts: "2026-07-23T12:00:00Z",
    audio_path: "clip.mp3",
    transcript: "Box this lap, box this lap.",
    status: "done",
    error: null,
    transcribed_at: "2026-07-23T12:00:05Z",
    speaker_role: "pit_wall",
    is_notable: null,
    notable_reason: null,
    ...overrides,
  };
}

describe("NotableRadioWidget", () => {
  it('renders "No notable radio yet." when there are no notable clips', () => {
    render(<NotableRadioWidget clips={[]} />);
    expect(screen.getByText(/no notable radio yet/i)).toBeInTheDocument();
  });

  it("renders only notable clips out of a mixed array", () => {
    const clips: TeamRadioClip[] = [
      makeClip({ id: 1, driver_number: 3, is_notable: true, transcript: "Box now, incident ahead.", notable_reason: "Incident call" }),
      makeClip({ id: 2, driver_number: 16, is_notable: false, transcript: "Copy that, all good." }),
      makeClip({ id: 3, driver_number: 44, is_notable: null, transcript: "Not yet analyzed." }),
    ];
    render(<NotableRadioWidget clips={clips} />);
    expect(screen.getByText(/box now, incident ahead/i)).toBeInTheDocument();
    expect(screen.queryByText(/copy that, all good/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not yet analyzed/i)).not.toBeInTheDocument();
  });

  it("renders the notable_reason text", () => {
    render(
      <NotableRadioWidget
        clips={[makeClip({ is_notable: true, notable_reason: "Driver retiring from the race" })]}
      />
    );
    expect(screen.getByText(/driver retiring from the race/i)).toBeInTheDocument();
  });

  it("sorts notable clips newest-first by ts", () => {
    const clips: TeamRadioClip[] = [
      makeClip({ id: 1, driver_number: 3, is_notable: true, ts: "2026-07-23T12:00:00Z" }),
      makeClip({ id: 2, driver_number: 16, is_notable: true, ts: "2026-07-23T12:05:00Z" }),
    ];
    render(<NotableRadioWidget clips={clips} />);
    const tlas = screen.getAllByText(/^(VER|LEC)$/).map((el) => el.textContent);
    expect(tlas).toEqual(["LEC", "VER"]);
  });
});
