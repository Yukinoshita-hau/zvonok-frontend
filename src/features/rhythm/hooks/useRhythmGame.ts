import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MISS_WINDOW_MS, getJudgmentByDiff, isMissedByTime } from "../engine/judgment";
import { applyJudgment, createInitialScoreState } from "../engine/scoring";
import { getAudioTimeMs, getEffectiveNoteTimeMs } from "../engine/timing";
import { validateRhythmMap } from "../engine/mapValidation";
import type { GameStatus, JudgmentName, RhythmLane, RhythmMap, RhythmSettings, RhythmScoreState, RuntimeNote } from "../model/rhythmTypes";

const DEFAULT_SETTINGS: RhythmSettings = {
  approachTimeMs: 1800,
  inputOffsetMs: 0,
  noteSize: 1,
  effectIntensity: 1,
  backgroundDim: 0.5,
  showBarlines: true,
  backgroundPreset: "nebula",
  keyBindings: {
    KeyD: 0,
    KeyF: 1,
    KeyJ: 2,
    KeyK: 3,
  },
};

function createRuntimeNotes(map: RhythmMap): RuntimeNote[] {
  return [...map.notes]
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((note) => ({ ...note, judged: false }));
}

function shouldIgnoreKeyboardEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return ["input", "textarea", "select", "button"].includes(tagName);
}

export function useRhythmGame(map: RhythmMap) {
  const validationErrors = useMemo(() => validateRhythmMap(map), [map]);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [notes, setNotes] = useState<RuntimeNote[]>(() => createRuntimeNotes(map));
  const [scoreState, setScoreState] = useState<RhythmScoreState>(() => createInitialScoreState(map.notes.length));
  const [settings, setSettings] = useState<RhythmSettings>(DEFAULT_SETTINGS);
  const [pressedLanes, setPressedLanes] = useState<Record<RhythmLane, boolean>>({ 0: false, 1: false, 2: false, 3: false });
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hitEffects, setHitEffects] = useState<Array<{ lane: RhythmLane; atMs: number; judgment: JudgmentName }>>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const statusRef = useRef<GameStatus>(status);
  const settingsRef = useRef<RhythmSettings>(settings);
  const notesRef = useRef<RuntimeNote[]>(notes);
  const scoreRef = useRef<RhythmScoreState>(scoreState);
  const audioUrlRef = useRef<string>("");

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { scoreRef.current = scoreState; }, [scoreState]);

  const finishGame = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setStatus("finished");
  }, []);

  const frame = useCallback(() => {
    if (statusRef.current !== "playing") return;
    const audio = audioRef.current;
    const currentTimeMs = getAudioTimeMs(audio);

    let changed = false;
    let nextScore = scoreRef.current;

    const nextNotes = notesRef.current.map((note) => {
      if (note.judged) return note;
      const effectiveTime = getEffectiveNoteTimeMs(note.timeMs, map.offsetMs, settingsRef.current.inputOffsetMs);
      if (isMissedByTime(currentTimeMs, effectiveTime)) {
        changed = true;
        nextScore = applyJudgment(nextScore, "MISS");
        return { ...note, judged: true, judgment: "MISS" as const };
      }
      return note;
    });

    if (changed) {
      notesRef.current = nextNotes;
      scoreRef.current = nextScore;
      setNotes(nextNotes);
      setScoreState(nextScore);
    }

    const allJudged = notesRef.current.every((note) => note.judged);
    if (allJudged || audio?.ended) {
      finishGame();
      return;
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [finishGame, map.offsetMs]);

  const startLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(frame);
  }, [frame]);

  const resetGameState = useCallback(() => {
    const runtime = createRuntimeNotes(map);
    const score = createInitialScoreState(map.notes.length);
    notesRef.current = runtime;
    scoreRef.current = score;
    setNotes(runtime);
    setScoreState(score);
  }, [map]);

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      setErrorMessage("");
      audio.currentTime = 0;
      await audio.play();
      setStatus("playing");
      startLoop();
    } catch {
      setErrorMessage("Unable to start playback. Interact with the page and try again.");
      setStatus("ready");
    }
  }, [startLoop]);

  const selectAudioFile = useCallback((file: File | null) => {
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
    setStatus("ready");
  }, []);

  const start = useCallback(async () => {
    if (!audioUrl || validationErrors.length > 0 || statusRef.current === "playing") return;
    resetGameState();
    await startPlayback();
  }, [audioUrl, resetGameState, startPlayback, validationErrors.length]);

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    audioRef.current?.pause();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setStatus("paused");
  }, []);

  const resume = useCallback(async () => {
    if (statusRef.current !== "paused") return;
    try {
      setErrorMessage("");
      await audioRef.current?.play();
      setStatus("playing");
      startLoop();
    } catch {
      setErrorMessage("Unable to resume playback.");
    }
  }, [startLoop]);

  const restart = useCallback(async () => {
    if (!audioUrl) return;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    resetGameState();
    await startPlayback();
  }, [audioUrl, resetGameState, startPlayback]);

  const updateSettings = useCallback((patch: Partial<RhythmSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || shouldIgnoreKeyboardEvent(event)) return;
      const lane = settingsRef.current.keyBindings[event.code];
      if (lane === undefined) return;
      setPressedLanes((prev) => ({ ...prev, [lane]: true }));
      if (statusRef.current !== "playing") return;

      const audio = audioRef.current;
      const currentTimeMs = getAudioTimeMs(audio);

      let bestIndex = -1;
      let bestAbs = Number.POSITIVE_INFINITY;
      let bestDiff = 0;

      notesRef.current.forEach((note, index) => {
        if (note.judged || note.lane !== lane) return;
        const effectiveTime = getEffectiveNoteTimeMs(note.timeMs, map.offsetMs, settingsRef.current.inputOffsetMs);
        const diff = currentTimeMs - effectiveTime;
        const abs = Math.abs(diff);
        if (abs <= MISS_WINDOW_MS && abs < bestAbs) {
          bestAbs = abs;
          bestIndex = index;
          bestDiff = diff;
        }
      });

      if (bestIndex < 0) return;
      const judgment = getJudgmentByDiff(bestDiff);
      if (!judgment) return;

      const target = notesRef.current[bestIndex];
      if (!target || target.judged) return;

      const nextNotes = notesRef.current.map((note, index) =>
        index === bestIndex ? { ...note, judged: true, judgment, hitDiffMs: bestDiff } : note,
      );

      const nextScore = applyJudgment(scoreRef.current, judgment, bestDiff);
      setHitEffects((prev) => [...prev.slice(-18), { lane, atMs: performance.now(), judgment }]);
      notesRef.current = nextNotes;
      scoreRef.current = nextScore;
      setNotes(nextNotes);
      setScoreState(nextScore);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const lane = settingsRef.current.keyBindings[event.code];
      if (lane === undefined) return;
      setPressedLanes((prev) => ({ ...prev, [lane]: false }));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [map.offsetMs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => finishGame();
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [finishGame]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setHitEffects((prev) => prev.filter((fx) => performance.now() - fx.atMs < 260));
    }, 80);

    return () => {
      window.clearInterval(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  return {
    status,
    map,
    notes,
    scoreState,
    settings,
    pressedLanes,
    audioRef,
    audioUrl,
    validationErrors,
    errorMessage,
    selectAudioFile,
    start,
    pause,
    resume,
    restart,
    updateSettings,
    hitEffects,
  };
}
