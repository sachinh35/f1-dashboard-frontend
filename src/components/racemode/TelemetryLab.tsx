import React, { useEffect, useRef } from "react";
import { getRosterEntry } from "../../data/driverRoster";
import { TelemetrySample } from "../../types/raceMode";

interface TelemetryLabProps {
  /** A ref, not React state - see TrackMap.tsx for why. */
  telemetryRef: React.MutableRefObject<Record<string, TelemetrySample>>;
  /** Up to 4 drivers, selected by clicking rows in the timing tower. */
  selectedDrivers: number[];
}

const MAX_HISTORY = 300;

const TelemetryLab: React.FC<TelemetryLabProps> = ({ telemetryRef, selectedDrivers }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<Record<number, number[]>>({});
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

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      for (const driverNumber of drivers) {
        const sample = telemetryRef.current[String(driverNumber)];
        if (sample && sample !== lastSeenRef.current[driverNumber]) {
          lastSeenRef.current[driverNumber] = sample;
          const history = historyRef.current[driverNumber] ?? (historyRef.current[driverNumber] = []);
          history.push(sample.speed_kmh);
          if (history.length > MAX_HISTORY) history.shift();
        }
      }

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        const y = (i / 3) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (drivers.length === 0) {
        ctx.fillStyle = "#5b6472";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.fillText("Select up to 4 drivers in the timing tower to compare speed", 12, 20);
      }

      drivers.forEach((driverNumber) => {
        const history = historyRef.current[driverNumber];
        if (!history || history.length < 2) return;
        const roster = getRosterEntry(driverNumber);
        const max = Math.max(...history, 1);

        ctx.beginPath();
        history.forEach((speed, i) => {
          const x = (i / (MAX_HISTORY - 1)) * w;
          const y = h - (speed / max) * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = roster.teamColor;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // emphasize the endpoint
        const lastSpeed = history[history.length - 1];
        const lx = w;
        const ly = h - (lastSpeed / max) * h;
        ctx.beginPath();
        ctx.arc(lx - 3, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = roster.teamColor;
        ctx.fill();
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
              {roster.tla} speed (km/h)
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default TelemetryLab;
