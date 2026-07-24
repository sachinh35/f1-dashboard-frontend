import React, { useEffect, useRef } from "react";
import { getRosterEntry } from "../../data/driverRoster";
import { PositionSample } from "../../types/raceMode";

interface TrackMapProps {
  /** A ref, not React state - Position.z arrives several times a second per car, and
   * routing that through component re-renders would jank. This canvas reads directly
   * off the ref every animation frame instead. */
  positionsRef: React.MutableRefObject<Record<string, PositionSample>>;
  /** Per-driver history of {x,y} points accumulated over the session - drawn as the
   * track outline. F1's feed never sends circuit geometry; cars repeatedly tracing
   * the same circuit *is* the track shape, so this is derived, not decorative. */
  trailRef: React.MutableRefObject<Record<string, { x: number; y: number }[]>>;
  selectedDrivers: number[];
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const TrackMap: React.FC<TrackMapProps> = ({ positionsRef, trailRef, selectedDrivers }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boundsRef = useRef<Bounds>({ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

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

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const positions = positionsRef.current;
      const trails = trailRef.current;
      const bounds = boundsRef.current;
      const positionEntries = Object.entries(positions);
      const trailDrivers = Object.keys(trails);

      // Bounds come from the accumulated trail, not just the current instant's
      // car positions - the trail covers the whole circuit within a lap or two,
      // while live positions alone only ever cover a small arc of the track.
      for (const points of Object.values(trails)) {
        for (const p of points) {
          if (p.x < bounds.minX) bounds.minX = p.x;
          if (p.x > bounds.maxX) bounds.maxX = p.x;
          if (p.y < bounds.minY) bounds.minY = p.y;
          if (p.y > bounds.maxY) bounds.maxY = p.y;
        }
      }

      if (trailDrivers.length > 0 && Number.isFinite(bounds.minX)) {
        const spanX = bounds.maxX - bounds.minX || 1;
        const spanY = bounds.maxY - bounds.minY || 1;
        const padding = 24;
        const scale = Math.min((w - padding * 2) / spanX, (h - padding * 2) / spanY);

        const toCanvasX = (x: number) => padding + (x - bounds.minX) * scale;
        const toCanvasY = (y: number) => h - padding - (y - bounds.minY) * scale;

        // Track outline: each driver's accumulated path, drawn as a thin,
        // low-opacity connected line. Overlapping laps/drivers reinforce the
        // same shape rather than smearing into noise, since everyone drives
        // (roughly) the same circuit.
        ctx.strokeStyle = "rgba(238, 242, 247, 0.16)";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (const points of Object.values(trails)) {
          if (points.length < 2) continue;
          ctx.beginPath();
          points.forEach((p, i) => {
            const cx = toCanvasX(p.x);
            const cy = toCanvasY(p.y);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          });
          ctx.stroke();
        }

        // Live cars, on top of the track outline.
        for (const [driverStr, pos] of positionEntries) {
          const driverNumber = Number(driverStr);
          const roster = getRosterEntry(driverNumber);
          const selected = selectedDrivers.includes(driverNumber);
          const cx = toCanvasX(pos.x);
          const cy = toCanvasY(pos.y);

          ctx.beginPath();
          ctx.arc(cx, cy, selected ? 6 : 4, 0, Math.PI * 2);
          ctx.fillStyle = roster.teamColor;
          ctx.fill();
          if (selected) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();
          }
        }
      } else {
        ctx.fillStyle = "#5b6472";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.fillText("Waiting for position data…", 12, 20);
      }

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [positionsRef, selectedDrivers]);

  return <canvas ref={canvasRef} className="rm-trackmap-canvas" />;
};

export default TrackMap;
