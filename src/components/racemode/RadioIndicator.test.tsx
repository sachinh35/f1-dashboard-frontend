import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RadioIndicator from "./RadioIndicator";
import { TeamRadioClip } from "../../types/raceMode";

const baseClip: TeamRadioClip = {
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
  is_notable: false,
  notable_reason: null,
};

describe("RadioIndicator", () => {
  it("renders nothing when clip is undefined", () => {
    const { container } = render(<RadioIndicator clip={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when clip.transcript is null", () => {
    const { container } = render(<RadioIndicator clip={{ ...baseClip, transcript: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reveals the transcript on hover", () => {
    render(<RadioIndicator clip={baseClip} />);
    const badge = screen.getByTitle(/team radio/i);

    expect(screen.queryByText(/box this lap/i)).not.toBeInTheDocument();

    fireEvent.mouseEnter(badge);

    expect(screen.getByText(/box this lap/i)).toBeInTheDocument();
    expect(screen.getByText(/lap 12/i)).toBeInTheDocument();
  });

  it("reveals the transcript on keyboard focus as well as hover", () => {
    render(<RadioIndicator clip={baseClip} />);
    const badge = screen.getByTitle(/team radio/i);

    fireEvent.focus(badge);
    expect(screen.getByText(/box this lap/i)).toBeInTheDocument();

    fireEvent.blur(badge);
    expect(screen.queryByText(/box this lap/i)).not.toBeInTheDocument();
  });

  it("shows notable_reason on hover and is visually distinct from a non-notable clip", () => {
    const notableClip: TeamRadioClip = {
      ...baseClip,
      is_notable: true,
      notable_reason: "Driver retiring from the race",
    };
    const { container: notableContainer } = render(<RadioIndicator clip={notableClip} />);
    const notableBadge = notableContainer.querySelector(".radio-indicator-badge");
    expect(notableBadge).not.toBeNull();
    expect(notableBadge?.className).toContain("radio-indicator-notable");

    fireEvent.mouseEnter(notableBadge as Element);
    expect(screen.getByText(/driver retiring from the race/i)).toBeInTheDocument();

    const { container: plainContainer } = render(<RadioIndicator clip={baseClip} />);
    const plainBadge = plainContainer.querySelector(".radio-indicator-badge");
    expect(plainBadge).not.toBeNull();
    expect(plainBadge?.className).not.toContain("radio-indicator-notable");
    expect(plainBadge?.className).not.toEqual(notableBadge?.className);
  });
});
