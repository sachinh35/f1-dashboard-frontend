import React, { useEffect, useRef } from "react";
import { getRosterEntry } from "../../data/driverRoster";
import { TelemetrySample } from "../../types/raceMode";

interface TelemetryLabProps {
  /** A ref, not React state - see TrackMap.tsx for why. */
  telemetryRef: React.MutableRefObject<Record<string, TelemetrySample>>;
  /** Up to 4 drivers, selected by clicking rows in the timing tower. */
  selectedDrivers: number[];
}

interface DriverHistory {
  speed: number[];
  throttle: number[];
  brake: number[];
}

const MAX_HISTORY = 300;
const BAND_GAP = 6;
const BAND_LABEL_COLOR = "#5b6472";
const GRIDLINE_STYLE = "rgba(255,255,255,0.06)";

/**
 * Pure coordinate-transform: maps a data value within [0, domainMax] to a
 * canvas y pixel coordinate confined to a horizontal band, with the band's
 * own top-left origin as (bandTop, value=0) baseline. Kept side-effect free
 * (no canvas/DOM access) so it can be unit tested directly rather than by
 * pixel-diffing canvas output - see TelemetryLab.test.tsx.
 */
export function scaleToBand(value: number, domainMax: number, bandTop: number, bandHeight: number): number {
  return bandTop + bandHeight - (value / domainMax) * bandHeight;
}

const TelemetryLab: React.FC<TelemetryLabProps> = ({ telemetryRef, selectedDrivers }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<Record<number, DriverHistory>>({});
  const lastSeenRef = useRef<Record<number, TelemetrySample | undefined>>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const drivers = selectedDrivers.slice(0, 4);

    const drawBandGridlines = (bandTop: number, bandHeight: number, w: number) => {
      ctx.strokeStyle = GRIDLINE_STYLE;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 2; i++) {
        const y = bandTop + (i / 2) * bandHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    const drawBandLabel = (label: string, bandTop: number) => {
      ctx.fillStyle = BAND_LABEL_COLOR;
      ctx.font = "10px -apple-system, sans-serif";
      ctx.fillText(label, 4, bandTop + 11);
    };

    const drawSeries = (
      values: number[],
      color: string,
      w: number,
      domainMax: number,
      bandTop: number,
      bandHeight: number
    ) => {
      if (values.length < 2) return;

      ctx.beginPath();
      values.forEach((value, i) => {
        const x = (i / (MAX_HISTORY - 1)) * w;
        const y = scaleToBand(value, domainMax, bandTop, bandHeight);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // emphasize the endpoint
      const lastValue = values[values.length - 1];
      const ly = scaleToBand(lastValue, domainMax, bandTop, bandHeight);
      ctx.beginPath();
      ctx.arc(w - 3, ly, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      for (const driverNumber of drivers) {
        const sample = telemetryRef.current[String(driverNumber)];
        if (sample && sample !== lastSeenRef.current[driverNumber]) {
          lastSeenRef.current[driverNumber] = sample;
          const history =
            historyRef.current[driverNumber] ??
            (historyRef.current[driverNumber] = { speed: [], throttle: [], brake: [] });
          history.speed.push(sample.speed_kmh);
          history.throttle.push(sample.throttle_pct);
          history.brake.push(sample.brake_pct);
          if (history.speed.length > MAX_HISTORY) history.speed.shift();
          if (history.throttle.length > MAX_HISTORY) history.throttle.shift();
          if (history.brake.length > MAX_HISTORY) history.brake.shift();
        }
      }

      const bandHeight = (h - BAND_GAP * 2) / 3;
      const speedTop = 0;
      const throttleTop = bandHeight + BAND_GAP;
      const brakeTop = (bandHeight + BAND_GAP) * 2;

      drawBandGridlines(speedTop, bandHeight, w);
      drawBandGridlines(throttleTop, bandHeight, w);
      drawBandGridlines(brakeTop, bandHeight, w);

      drawBandLabel("SPEED", speedTop);
      drawBandLabel("THROTTLE", throttleTop);
      drawBandLabel("BRAKE", brakeTop);

      if (drivers.length === 0) {
        ctx.fillStyle = "#5b6472";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.fillText("Select up to 4 drivers in the timing tower to compare telemetry", 12, 20);
      }

      drivers.forEach((driverNumber) => {
        const history = historyRef.current[driverNumber];
        if (!history) return;
        const roster = getRosterEntry(driverNumber);

        // Speed keeps this driver's own rolling max as the domain - preserves
        // the existing, already-understood normalization behavior.
        const speedMax = Math.max(...history.speed, 1);
        drawSeries(history.speed, roster.teamColor, w, speedMax, speedTop, bandHeight);

        // Throttle/brake are percentages, directly comparable across
        // drivers - use a fixed 0-100 domain rather than per-driver max, so
        // a driver who only lightly brakes doesn't look visually "pinned".
        drawSeries(history.throttle, roster.teamColor, w, 100, throttleTop, bandHeight);
        drawSeries(history.brake, roster.teamColor, w, 100, brakeTop, bandHeight);
      });

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [telemetryRef, selectedDrivers]);

  return (
    <div>
      <canvas ref={canvasRef} className="rm-telemetry-canvas" />
      <div className="rm-telemetry-legend">
        {selectedDrivers.slice(0, 4).map((driverNumber) => {
          const roster = getRosterEntry(driverNumber);
          return (
            <span key={driverNumber}>
              <i style={{ background: roster.teamColor }} />
              {roster.tla} — speed / throttle / brake
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default TelemetryLab;
