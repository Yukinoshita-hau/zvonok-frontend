import type { RhythmLane, RhythmMap, RhythmNote } from "./rhythmTypes";

function createDemoNotes(): RhythmNote[] {
  const notes: RhythmNote[] = [];
  let timeMs = 2000;
  const pattern: RhythmLane[] = [0, 1, 2, 3, 0, 2, 1, 3];

  for (let i = 0; i < 96; i += 1) {
    const lane = pattern[i % pattern.length];
    notes.push({
      id: `demo-${i + 1}`,
      timeMs,
      lane,
      type: "tap",
    });
    const spacing = i % 4 === 3 ? 500 : 250;
    timeMs += spacing;
  }

  return notes;
}

export const demoRhythmMap: RhythmMap = {
  id: "demo-4k",
  title: "Demo 4K Pattern",
  artist: "Local Audio",
  bpm: 140,
  offsetMs: 0,
  lanes: 4,
  notes: createDemoNotes(),
};
