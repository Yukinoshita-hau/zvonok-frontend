import type { RhythmMap } from "../model/rhythmTypes";

export function validateRhythmMap(map: RhythmMap): string[] {
  const errors: string[] = [];

  if (map.lanes !== 4) {
    errors.push("Map lanes must be exactly 4 for MVP mode.");
  }

  if (!map.notes.length) {
    errors.push("Map has no notes.");
  }

  const idSet = new Set<string>();
  let prevTime = -1;

  map.notes.forEach((note, index) => {
    if (note.timeMs < 0) {
      errors.push(`Note ${note.id} has negative timeMs.`);
    }

    if (note.lane < 0 || note.lane > 3) {
      errors.push(`Note ${note.id} has invalid lane ${note.lane}.`);
    }

    if (note.type !== "tap" && note.type !== "hold") {
      errors.push(`Note ${note.id} has invalid type ${note.type}.`);
    }

    if (idSet.has(note.id)) {
      errors.push(`Duplicate note id detected: ${note.id}.`);
    }
    idSet.add(note.id);

    if (note.timeMs < prevTime) {
      errors.push(`Notes are not sorted by time at index ${index}.`);
    }
    prevTime = note.timeMs;
  });

  return errors;
}
