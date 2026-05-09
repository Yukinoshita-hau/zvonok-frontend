export function getAudioTimeMs(audio: HTMLAudioElement | null): number {
  if (!audio) return 0;
  return audio.currentTime * 1000;
}

export function getEffectiveNoteTimeMs(
  noteTimeMs: number,
  mapOffsetMs: number,
  inputOffsetMs: number,
): number {
  return noteTimeMs + mapOffsetMs + inputOffsetMs;
}
