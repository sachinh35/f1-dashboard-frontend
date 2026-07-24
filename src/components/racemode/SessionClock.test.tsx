import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionClock from "./SessionClock";

describe("SessionClock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a placeholder before any clock data has arrived", () => {
    render(<SessionClock lapCount={{}} extrapolatedClock={{}} />);
    expect(screen.getByText("--:--:--")).toBeInTheDocument();
  });

  it("displays the initial Remaining value from the feed", () => {
    render(<SessionClock lapCount={{ CurrentLap: 5 }} extrapolatedClock={{ Remaining: "01:59:59", Extrapolating: true }} />);
    expect(screen.getByText("1:59:59")).toBeInTheDocument();
  });

  it(
    "ticks the remaining time down locally when Extrapolating is true - " +
      "regression test for the bug where the clock froze at whatever value F1 sent once",
    async () => {
      vi.useFakeTimers();
      render(<SessionClock lapCount={{ CurrentLap: 5 }} extrapolatedClock={{ Remaining: "01:59:59", Extrapolating: true }} />);

      expect(screen.getByText("1:59:59")).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(3000);

      expect(screen.getByText("1:59:56")).toBeInTheDocument();
    }
  );

  it("does not tick when Extrapolating is false", async () => {
    vi.useFakeTimers();
    render(<SessionClock lapCount={{}} extrapolatedClock={{ Remaining: "00:30:00", Extrapolating: false }} />);

    await vi.advanceTimersByTimeAsync(5000);

    expect(screen.getByText("0:30:00")).toBeInTheDocument();
  });

  it("re-anchors to a fresh value when a new ExtrapolatedClock event arrives", () => {
    const { rerender } = render(
      <SessionClock lapCount={{}} extrapolatedClock={{ Remaining: "01:00:00", Extrapolating: true }} />
    );
    expect(screen.getByText("1:00:00")).toBeInTheDocument();

    rerender(<SessionClock lapCount={{}} extrapolatedClock={{ Remaining: "00:45:00", Extrapolating: true }} />);
    expect(screen.getByText("0:45:00")).toBeInTheDocument();
  });
});
