import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Dashboard from "./Dashboard";
import * as api from "../services/api";

vi.mock("../services/api", () => ({
    getYears: vi.fn().mockResolvedValue([]),
    getRacesForYear: vi.fn().mockResolvedValue([]),
    getSessionResults: vi.fn().mockResolvedValue([]),
    getSessionLapData: vi.fn().mockResolvedValue([]),
    getSessionStints: vi.fn().mockResolvedValue([]),
    getSessionRaceControlEvents: vi.fn().mockResolvedValue([]),
    startLiveStream: vi.fn(),
    startSimulation: vi.fn(),
    getTeamDriverPool: vi.fn().mockResolvedValue({ season_year: 2026, drivers: [] }),
}));

beforeEach(() => {
    vi.mocked(api.startLiveStream).mockReset();
    vi.mocked(api.startSimulation).mockReset();
    vi.mocked(api.getTeamDriverPool).mockReset();
    vi.mocked(api.getTeamDriverPool).mockResolvedValue({ season_year: 2026, drivers: [] });
});

describe("Dashboard start-stream wiring", () => {
    it("clicking 'Start Live Stream' opens the roster confirmation dialog instead of calling the API immediately", async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: /start live stream/i }));

        await waitFor(() => expect(screen.getByText("Confirm Lineup Before Going Live")).toBeInTheDocument());
        expect(api.startLiveStream).not.toHaveBeenCalled();
    });

    it("clicking 'Test Simulation' opens the roster confirmation dialog instead of calling the API immediately", async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: /test simulation/i }));

        await waitFor(() => expect(screen.getByText("Confirm Lineup for Simulation")).toBeInTheDocument());
        expect(api.startSimulation).not.toHaveBeenCalled();
    });
});
