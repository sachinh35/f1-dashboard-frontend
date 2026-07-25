import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import RaceControlFeed from "./RaceControlFeed";

beforeAll(() => {
  // Fixed, non-UTC offset so a wrong "just display the raw UTC substring" implementation
  // is guaranteed to diverge from the correct local-time conversion in this test run,
  // regardless of the machine/CI runner's own real time zone.
  vi.stubEnv("TZ", "America/New_York");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("RaceControlFeed", () => {
  it('renders "No race control messages yet." when empty', () => {
    render(<RaceControlFeed messages={{}} />);
    expect(screen.getByText(/no race control messages yet/i)).toBeInTheDocument();
  });

  it("converts F1's offset-less UTC timestamp to the browser's local time, not a raw substring of the UTC string", () => {
    // F1's RaceControlMessages.Utc carries no 'Z'/offset suffix but is always UTC.
    // 2025-11-30T15:57:04 UTC -> 10:57 in America/New_York (UTC-5 in late November).
    render(
      <RaceControlFeed
        messages={{ "1": { Utc: "2025-11-30T15:57:04", Category: "Flag", Message: "GREEN LIGHT" } }}
      />
    );
    expect(screen.getByText("10:57")).toBeInTheDocument();
    expect(screen.queryByText("15:57")).not.toBeInTheDocument();
  });

  it("renders the category and message text", () => {
    render(
      <RaceControlFeed
        messages={{ "1": { Utc: "2025-11-30T15:57:04", Category: "Flag", Message: "GREEN LIGHT" } }}
      />
    );
    expect(screen.getByText("Flag")).toBeInTheDocument();
    expect(screen.getByText("GREEN LIGHT")).toBeInTheDocument();
  });

  it("sorts entries newest-first by message index", () => {
    render(
      <RaceControlFeed
        messages={{
          "1": { Utc: "2025-11-30T15:00:00", Category: "Other", Message: "First" },
          "2": { Utc: "2025-11-30T15:05:00", Category: "Other", Message: "Second" },
        }}
      />
    );
    const messages = screen.getAllByText(/^(First|Second)$/).map((el) => el.textContent);
    expect(messages).toEqual(["Second", "First"]);
  });
});
