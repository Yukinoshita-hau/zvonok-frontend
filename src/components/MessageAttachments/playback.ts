export interface PlaybackEngine {
  play(): Promise<void>;
  pause(): void;
  currentTime: number;
  volume: number;
  playbackRate: number;
  readonly paused: boolean;
}

// Only attachment elements register here; call media never enters this registry.
export class AttachmentMediaCoordinator {
  private elements = new Set<PlaybackEngine>();
  register(element: PlaybackEngine) {
    let saved = 1;
    try { saved = Number(localStorage.getItem('zvonok.attachment.volume') ?? 1); } catch { /* Storage may be disabled. */ }
    element.volume = Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1;
    this.elements.add(element);
    return () => { element.pause(); this.elements.delete(element); };
  }
  activate(element: PlaybackEngine) {
    for (const other of this.elements) if (other !== element) other.pause();
  }
  saveVolume(element: PlaybackEngine) {
    try { localStorage.setItem('zvonok.attachment.volume', String(element.volume)); } catch { /* Session volume still works. */ }
  }
  pauseAll() { for (const element of this.elements) element.pause(); }
}
export const attachmentMedia = new AttachmentMediaCoordinator();

export function playbackShortcut(engine: PlaybackEngine, key: string) {
  if (key === ' ' || key === 'k') {
    if (engine.paused) void engine.play().catch(() => {}); else engine.pause();
  } else if (key === 'ArrowRight') engine.currentTime += 5;
  else if (key === 'ArrowLeft') engine.currentTime = Math.max(0, engine.currentTime - 5);
  else return false;
  return true;
}
