/**
 * Static fallback driver/team roster.
 *
 * F1's live timing DriverList topic never actually carries names, teams, or
 * colours - confirmed by scanning the largest DriverList payload across a
 * full captured race: every message only ever contains a grid "Line" number.
 * This table fills that gap so the tower/map/telemetry views can show real
 * names and team colour instead of bare driver numbers. Live data (Line,
 * timing) always takes priority where it exists; this is purely a fallback
 * for identity, and needs a yearly update as the grid changes.
 */
export interface RosterEntry {
  driverNumber: number;
  tla: string;
  fullName: string;
  team: string;
  teamColor: string;
}

export const DRIVER_ROSTER: Record<number, RosterEntry> = {
  1: { driverNumber: 1, tla: "VER", fullName: "Max Verstappen", team: "Red Bull Racing", teamColor: "#3671C6" },
  4: { driverNumber: 4, tla: "NOR", fullName: "Lando Norris", team: "McLaren", teamColor: "#F58020" },
  5: { driverNumber: 5, tla: "BOR", fullName: "Gabriel Bortoleto", team: "Kick Sauber", teamColor: "#52E252" },
  6: { driverNumber: 6, tla: "HAD", fullName: "Isack Hadjar", team: "Racing Bulls", teamColor: "#6692FF" },
  10: { driverNumber: 10, tla: "GAS", fullName: "Pierre Gasly", team: "Alpine", teamColor: "#0093CC" },
  12: { driverNumber: 12, tla: "ANT", fullName: "Kimi Antonelli", team: "Mercedes", teamColor: "#27F4D2" },
  14: { driverNumber: 14, tla: "ALO", fullName: "Fernando Alonso", team: "Aston Martin", teamColor: "#229971" },
  16: { driverNumber: 16, tla: "LEC", fullName: "Charles Leclerc", team: "Ferrari", teamColor: "#E8002D" },
  18: { driverNumber: 18, tla: "STR", fullName: "Lance Stroll", team: "Aston Martin", teamColor: "#229971" },
  22: { driverNumber: 22, tla: "TSU", fullName: "Yuki Tsunoda", team: "Red Bull Racing", teamColor: "#3671C6" },
  23: { driverNumber: 23, tla: "ALB", fullName: "Alexander Albon", team: "Williams", teamColor: "#64C4FF" },
  27: { driverNumber: 27, tla: "HUL", fullName: "Nico Hulkenberg", team: "Kick Sauber", teamColor: "#52E252" },
  30: { driverNumber: 30, tla: "LAW", fullName: "Liam Lawson", team: "Racing Bulls", teamColor: "#6692FF" },
  31: { driverNumber: 31, tla: "OCO", fullName: "Esteban Ocon", team: "Haas", teamColor: "#B6BABD" },
  43: { driverNumber: 43, tla: "COL", fullName: "Franco Colapinto", team: "Alpine", teamColor: "#0093CC" },
  44: { driverNumber: 44, tla: "HAM", fullName: "Lewis Hamilton", team: "Ferrari", teamColor: "#E8002D" },
  55: { driverNumber: 55, tla: "SAI", fullName: "Carlos Sainz", team: "Williams", teamColor: "#64C4FF" },
  63: { driverNumber: 63, tla: "RUS", fullName: "George Russell", team: "Mercedes", teamColor: "#27F4D2" },
  81: { driverNumber: 81, tla: "PIA", fullName: "Oscar Piastri", team: "McLaren", teamColor: "#F58020" },
  87: { driverNumber: 87, tla: "BEA", fullName: "Oliver Bearman", team: "Haas", teamColor: "#B6BABD" },
};

const FALLBACK_ENTRY = (driverNumber: number): RosterEntry => ({
  driverNumber,
  tla: String(driverNumber),
  fullName: `Driver ${driverNumber}`,
  team: "Unknown",
  teamColor: "#8b93a3",
});

export function getRosterEntry(driverNumber: number): RosterEntry {
  return DRIVER_ROSTER[driverNumber] ?? FALLBACK_ENTRY(driverNumber);
}
