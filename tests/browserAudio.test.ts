import { afterEach, expect, it, vi } from 'vitest';
import type { RemoteAudioTrack } from 'livekit-client';

const h = vi.hoisted(() => ({ index: 0, states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as { deps: unknown[]; cleanup?: () => void }[], jobs: [] as (() => void)[] }));
vi.mock('react', () => ({
  useRef: (initial: unknown) => { const index = h.index++; return h.refs[index] ??= { current: initial }; },
  useState: (initial: unknown) => {
    const index = h.index++;
    if (!(index in h.states)) h.states[index] = initial;
    return [h.states[index], (value: unknown) => { h.states[index] = value; }];
  },
  useEffect: (run: () => (() => void) | void, deps: unknown[]) => {
    const index = h.index++, previous = h.effects[index];
    if (previous && deps.every((value, at) => Object.is(value, previous.deps[at]))) return;
    h.jobs.push(() => { previous?.cleanup?.(); h.effects[index] = { deps, cleanup: run() || undefined }; });
  },
}));
import { BrowserAudio } from '../src/components/CallUi/BrowserActivity/BrowserAudio';

afterEach(() => {
  h.effects.forEach(effect => effect?.cleanup?.());
  h.index = 0; h.states = []; h.refs = []; h.effects = []; h.jobs = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shows muted playback while video is stale and resumes only a previously enabled track', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {});
  const audio = {
    paused: true, srcObject: null,
    pause: vi.fn(() => { audio.paused = true; }),
    play: vi.fn(async () => { audio.paused = false; }),
  };
  let track = { attach: vi.fn(), detach: vi.fn(), setVolume: vi.fn() } as unknown as RemoteAudioTrack;
  function render(fresh: boolean) {
    h.index = 0;
    const tree = BrowserAudio({ track, fresh });
    h.refs[0].current = audio;
    h.jobs.splice(0).forEach(job => job());
    return tree;
  }
  render(true);
  expect(audio.play).not.toHaveBeenCalled();
  const tree = render(true);
  tree.props.children[1].props.onClick();
  await Promise.resolve();
  expect(audio.paused).toBe(false);
  render(false);
  expect(audio.paused).toBe(true);
  expect(render(false).props.children[1].props.children).toBe('Включить звук сайта');
  track = { attach: vi.fn(), detach: vi.fn(), setVolume: vi.fn() } as unknown as RemoteAudioTrack;
  render(true);
  await Promise.resolve();
  expect(audio.play).toHaveBeenCalledTimes(2);
  expect(track.attach).toHaveBeenCalledWith(audio);
  expect(render(true).props.children[1].props.children).toBe('Выключить звук сайта');
});
