import { useEffect, useRef, type RefObject } from "react";
import { MISS_WINDOW_MS } from "../engine/judgment";
import { getAudioTimeMs, getEffectiveNoteTimeMs } from "../engine/timing";
import { drawCircularNote, drawReceptor } from "../canvas/drawHelpers";
import { rhythmTheme } from "../theme/rhythmTheme";
import type { GameStatus, JudgmentName, RhythmMap, RhythmSettings, RhythmLane, RuntimeNote } from "../model/rhythmTypes";
import styles from "../styles/RhythmGameCanvas.module.css";

interface Props {
  notes: RuntimeNote[];
  map: RhythmMap;
  settings: RhythmSettings;
  pressedLanes: Record<RhythmLane, boolean>;
  status: GameStatus;
  audioRef: RefObject<HTMLAudioElement | null>;
  hitEffects: Array<{ lane: RhythmLane; atMs: number; judgment: JudgmentName }>;
}

export function RhythmGameCanvas({ notes, map, settings, pressedLanes, status, audioRef, hitEffects }: Props) {
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
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const laneWidth = cssWidth / map.lanes;
      const hitLineY = 120;
      const startY = cssHeight + 40;
      const noteRadius = Math.min(18, laneWidth * 0.2) * settings.noteSize;
      const nowMs = getAudioTimeMs(audioRef.current);

      const bg = ctx.createLinearGradient(0, 0, 0, cssHeight);
      bg.addColorStop(0, "#171a2f");
      bg.addColorStop(1, "#090b13");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.fillStyle = `rgba(0,0,0,${settings.backgroundDim})`;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      for (let lane = 0; lane < map.lanes; lane += 1) {
        const accent = rhythmTheme.laneColors[lane];
        ctx.fillStyle = lane % 2 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
        ctx.fillRect(lane * laneWidth, 0, laneWidth, cssHeight);
        if (pressedLanes[lane as RhythmLane]) {
          ctx.fillStyle = rhythmTheme.lanePressed[lane];
          ctx.fillRect(lane * laneWidth, 0, laneWidth, cssHeight);
          ctx.fillStyle = accent;
          ctx.globalAlpha = 0.12;
          ctx.fillRect(lane * laneWidth + laneWidth * 0.25, 0, laneWidth * 0.5, cssHeight);
          ctx.globalAlpha = 1;
        }
      }

      if (settings.showBarlines) {
        const beatMs = 60000 / map.bpm;
        for (let i = -2; i < 24; i++) {
          const beatTime = Math.floor(nowMs / beatMs) * beatMs + i * beatMs;
          const until = beatTime - nowMs;
          const p = 1 - until / settings.approachTimeMs;
          const y = startY + (hitLineY - startY) * p;
          if (y < -20 || y > cssHeight + 30) continue;
          const measure = Math.round(beatTime / beatMs) % 4 === 0;
          ctx.strokeStyle = measure ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)";
          ctx.lineWidth = measure ? 1.8 : 1;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssWidth, y); ctx.stroke();
        }
      }

      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      for (let lane = 1; lane < map.lanes; lane += 1) {
        const x = lane * laneWidth; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cssHeight); ctx.stroke();
      }

      ctx.shadowColor = "#79dcff"; ctx.shadowBlur = 12;
      ctx.strokeStyle = "#7dd9ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, hitLineY); ctx.lineTo(cssWidth, hitLineY); ctx.stroke();
      ctx.shadowBlur = 0;

      for (let lane = 0; lane < map.lanes; lane += 1) {
        drawReceptor(ctx, lane * laneWidth + laneWidth / 2, hitLineY, noteRadius + 4, rhythmTheme.laneColors[lane], pressedLanes[lane as RhythmLane]);
      }

      notes.forEach((note) => {
        if (note.judged) return;
        const effectiveMs = getEffectiveNoteTimeMs(note.timeMs, map.offsetMs, settings.inputOffsetMs);
        const timeUntilHitMs = effectiveMs - nowMs;
        if (timeUntilHitMs > settings.approachTimeMs || timeUntilHitMs < -MISS_WINDOW_MS - 120) return;
        const progress = 1 - timeUntilHitMs / settings.approachTimeMs;
        const y = startY + (hitLineY - startY) * progress;
        const x = note.lane * laneWidth + laneWidth / 2;
        drawCircularNote(ctx, x, y, noteRadius, rhythmTheme.laneColors[note.lane]);
      });

      const nowPerf = performance.now();
      hitEffects.forEach((fx) => {
        const age = nowPerf - fx.atMs;
        if (age > 240) return;
        const laneX = fx.lane * laneWidth + laneWidth / 2;
        const t = age / 240;
        const radius = noteRadius + t * 32 * settings.effectIntensity;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = rhythmTheme.judgmentColors[fx.judgment];
        ctx.lineWidth = 3 - t * 2;
        ctx.beginPath();
        ctx.arc(laneX, hitLineY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      if (["playing", "paused", "finished"].includes(status)) animation = requestAnimationFrame(draw);
    };

    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [audioRef, hitEffects, map.bpm, map.lanes, map.offsetMs, notes, pressedLanes, settings, status]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
