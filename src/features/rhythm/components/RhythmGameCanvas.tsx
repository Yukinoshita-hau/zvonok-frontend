import { useEffect, useRef } from "react";
import { MISS_WINDOW_MS } from "../engine/judgment";
import { getAudioTimeMs, getEffectiveNoteTimeMs } from "../engine/timing";
import type { GameStatus, RhythmMap, RhythmSettings, RhythmLane, RuntimeNote } from "../model/rhythmTypes";
import styles from "../styles/RhythmGameCanvas.module.css";

interface Props {
  notes: RuntimeNote[];
  map: RhythmMap;
  settings: RhythmSettings;
  pressedLanes: Record<RhythmLane, boolean>;
  status: GameStatus;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function RhythmGameCanvas({ notes, map, settings, pressedLanes, status, audioRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animation = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = rect.width;
      const cssHeight = rect.height;
      const pixelWidth = Math.floor(cssWidth * dpr);
      const pixelHeight = Math.floor(cssHeight * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      ctx.fillStyle = "#141821";
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      const laneWidth = cssWidth / map.lanes;
      const hitLineY = 120;
      const startY = cssHeight + 40;
      const noteRadius = Math.min(18, laneWidth * 0.2);
      const nowMs = getAudioTimeMs(audioRef.current);

      for (let lane = 0; lane < map.lanes; lane += 1) {
        ctx.fillStyle = lane % 2 === 0 ? "#1b2230" : "#1f2737";
        ctx.fillRect(lane * laneWidth, 0, laneWidth, cssHeight);

        if (pressedLanes[lane as RhythmLane]) {
          ctx.fillStyle = "rgba(93, 201, 255, 0.2)";
          ctx.fillRect(lane * laneWidth, 0, laneWidth, cssHeight);
        }
      }

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      for (let lane = 1; lane < map.lanes; lane += 1) {
        const x = lane * laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
        ctx.stroke();
      }

      ctx.strokeStyle = "#6de0ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, hitLineY);
      ctx.lineTo(cssWidth, hitLineY);
      ctx.stroke();

      notes.forEach((note) => {
        if (note.judged) return;
        const effectiveMs = getEffectiveNoteTimeMs(note.timeMs, map.offsetMs, settings.inputOffsetMs);
        const timeUntilHitMs = effectiveMs - nowMs;

        if (timeUntilHitMs > settings.approachTimeMs || timeUntilHitMs < -MISS_WINDOW_MS - 120) return;

        const progress = 1 - timeUntilHitMs / settings.approachTimeMs;
        const y = startY + (hitLineY - startY) * progress;
        const x = note.lane * laneWidth + laneWidth / 2;

        ctx.fillStyle = "#f4f7ff";
        ctx.beginPath();
        ctx.roundRect(x - noteRadius, y - noteRadius, noteRadius * 2, noteRadius * 2, 6);
        ctx.fill();
      });

      if (status === "playing" || status === "paused") {
        animation = requestAnimationFrame(draw);
      }
    };

    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [audioRef, map.lanes, map.offsetMs, notes, pressedLanes, settings.approachTimeMs, settings.inputOffsetMs, status]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
