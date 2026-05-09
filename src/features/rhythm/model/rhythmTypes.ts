export type RhythmLane = 0 | 1 | 2 | 3;

export type RhythmNoteType = "tap" | "hold";

export type JudgmentName =
  | "MARVELOUS"
  | "PERFECT"
  | "GREAT"
  | "GOOD"
  | "BAD"
  | "MISS";

export type GameStatus = "idle" | "ready" | "playing" | "paused" | "finished";

export interface RhythmNote {
  id: string;
  timeMs: number;
  lane: RhythmLane;
  type: RhythmNoteType;
  durationMs?: number;
}

export interface RuntimeNote extends RhythmNote {
  judged: boolean;
  judgment?: JudgmentName;
  hitDiffMs?: number;
}

export interface RhythmMap {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  offsetMs: number;
  lanes: 4;
  audioUrl?: string;
  notes: RhythmNote[];
}

export interface JudgmentWindow {
  name: JudgmentName;
  maxDiffMs: number;
  scoreValue: number;
  accuracyValue: number;
  breaksCombo: boolean;
}

export interface RhythmSettings {
  approachTimeMs: number;
  inputOffsetMs: number;
  keyBindings: Record<string, RhythmLane>;
}

export interface JudgmentCounts {
  MARVELOUS: number;
  PERFECT: number;
  GREAT: number;
  GOOD: number;
  BAD: number;
  MISS: number;
}

export interface RhythmScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  accuracy: number;
  judgedNotes: number;
  totalNotes: number;
  totalAccuracyPoints: number;
  judgmentCounts: JudgmentCounts;
  lastJudgment?: JudgmentName;
  lastHitDiffMs?: number;
}
