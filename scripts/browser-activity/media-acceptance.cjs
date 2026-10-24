const SUSTAINED_MS = 600000, MAX_SAMPLE_GAP_MS = 4000;
const MEDIA_PROFILES = Object.freeze({
  '720p15': { width: 1280, height: 720, fps: 15 },
  '720p30': { width: 1280, height: 720, fps: 30 },
  '720p60': { width: 1280, height: 720, fps: 60 },
  '1080p30': { width: 1920, height: 1080, fps: 30 },
  '1080p60': { width: 1920, height: 1080, fps: 60 },
});
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function evaluateMediaAcceptance(samples, { requiredDurationMs = SUSTAINED_MS, profile = '720p15' } = {}) {
  if (!Number.isFinite(requiredDurationMs) || requiredDurationMs <= 0) throw Error('requiredDurationMs must be positive');
  const target = MEDIA_PROFILES[profile];
  if (!target) throw Error(`Unsupported media profile: ${profile}`);
  if (!Array.isArray(samples)) samples = [];
  const elapsed = samples.map(sample => sample?.elapsedMs);
  const samplingGaps = [];
  for (let index = 0; index < elapsed.length; index++) {
    if (!nonnegative(elapsed[index])) samplingGaps.push({ index, reason: 'missing_elapsed_time' });
    else if (index && nonnegative(elapsed[index - 1])) {
      const gapMs = elapsed[index] - elapsed[index - 1];
      if (gapMs <= 0 || gapMs > MAX_SAMPLE_GAP_MS) samplingGaps.push({ index, reason: gapMs <= 0 ? 'clock_regressed_or_stalled' : 'sampling_gap', gapMs });
    }
  }
  const observedMs = elapsed.length > 1 && nonnegative(elapsed[0]) && nonnegative(elapsed.at(-1))
    ? Math.max(0, elapsed.at(-1) - elapsed[0]) : 0;
  const duration = { status: observedMs >= requiredDurationMs ? 'PASS' : 'FAIL', observedMs, requiredMs: requiredDurationMs, sustainedMet: observedMs >= SUSTAINED_MS };
  const audio = {}, video = {};
  for (const viewer of ['a', 'b']) {
    const audioIssues = [], videoIssues = [], windows = [];
    let previousAudio, previousVideo, window;
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index], sound = sample?.[viewer], picture = sample?.[viewer === 'a' ? 'videoA' : 'videoB'];
      const validTime = nonnegative(sample?.elapsedMs);
      if (!validTime || !sound || typeof sound.trackSid !== 'string' || !sound.trackSid || !nonnegative(sound.totalSamplesReceived)) {
        audioIssues.push({ index, reason: 'missing_audio_sample' }); previousAudio = undefined;
      } else {
        if (sound.paused === true || sound.muted === true) audioIssues.push({ index, reason: 'audio_playback_stopped' });
        if (previousAudio) {
          if (sound.trackSid !== previousAudio.trackSid) audioIssues.push({ index, reason: 'audio_track_rotated' });
          else if (sound.totalSamplesReceived <= previousAudio.totalSamplesReceived) audioIssues.push({ index, reason: sound.totalSamplesReceived < previousAudio.totalSamplesReceived ? 'audio_counter_regressed' : 'audio_counter_stalled' });
          if (nonnegative(sound.at) && nonnegative(previousAudio.at) && sound.at <= previousAudio.at) audioIssues.push({ index, reason: 'audio_metrics_stale' });
        }
        previousAudio = sound;
      }
      if (!validTime || !picture || !nonnegative(picture.at) || !nonnegative(picture.framesDecoded)) {
        videoIssues.push({ index, reason: 'missing_video_sample' }); previousVideo = undefined; window = undefined; continue;
      }
      if (picture.fresh !== true) videoIssues.push({ index, reason: 'video_not_fresh' });
      if (picture.width !== target.width || picture.height !== target.height) videoIssues.push({ index, reason: 'video_resolution_mismatch', expected: `${target.width}x${target.height}`, actual: `${picture.width}x${picture.height}` });
      if (picture.publications !== 1) videoIssues.push({ index, reason: 'video_publication_count_not_one' });
      let reset = !previousVideo;
      if (previousVideo) {
        const deltaFrames = picture.framesDecoded - previousVideo.framesDecoded, deltaMs = picture.at - previousVideo.at;
        if (deltaMs <= 0) { videoIssues.push({ index, reason: 'video_clock_regressed_or_stalled' }); reset = true; }
        if (deltaMs > MAX_SAMPLE_GAP_MS) { videoIssues.push({ index, reason: 'video_metrics_gap', gapMs: deltaMs }); reset = true; }
        if (deltaFrames <= 0) videoIssues.push({ index, reason: deltaFrames < 0 ? 'video_counter_regressed' : 'video_counter_stalled' });
        if (deltaFrames < 0) reset = true;
        if (picture.trackSid && previousVideo.trackSid && picture.trackSid !== previousVideo.trackSid) {
          videoIssues.push({ index, reason: 'video_track_rotated' }); reset = true;
        }
      }
      if (reset) {
        window = { firstIndex: index, lastIndex: index, startAt: picture.at, endAt: picture.at, startFrames: picture.framesDecoded, endFrames: picture.framesDecoded };
        windows.push(window);
      } else {
        window.lastIndex = index; window.endAt = picture.at; window.endFrames = picture.framesDecoded;
      }
      previousVideo = picture;
    }
    const measured = windows.map(value => {
      const durationMs = value.endAt - value.startAt, frames = value.endFrames - value.startFrames;
      return { ...value, durationMs, frames, fps: durationMs > 0 ? frames * 1000 / durationMs : null };
    });
    const measuredMs = measured.reduce((sum, value) => sum + value.durationMs, 0), frames = measured.reduce((sum, value) => sum + value.frames, 0);
    const fps = measuredMs > 0 ? frames * 1000 / measuredMs : null;
    audio[viewer] = { status: samples.length >= 2 && !audioIssues.length && !samplingGaps.length ? 'PASS' : 'FAIL', issues: audioIssues };
    const minimumFps = target.fps * 0.95;
    video[viewer] = { status: fps !== null && fps >= minimumFps && !videoIssues.length && !samplingGaps.length ? 'PASS' : 'FAIL', fps, minimumFps, profile, measuredMs, windows: measured, issues: videoIssues };
  }
  const status = duration.status === 'PASS' && !samplingGaps.length && ['a', 'b'].every(viewer => audio[viewer].status === 'PASS' && video[viewer].status === 'PASS') ? 'PASS' : 'FAIL';
  return {
    status, sustainedStatus: duration.sustainedMet ? status : 'NOT VERIFIED', duration,
    sampling: { maximumGapMs: MAX_SAMPLE_GAP_MS, issues: samplingGaps }, audio, video,
    limitations: [
      'Проверка counters с интервалом около 2 с не доказывает отсутствие коротких аудиопровалов или физическую слышимость.',
      'Video FPS вычислен по performance.at отдельно у каждого viewer; сброс clocks/counters разделяет окна и считается ошибкой.',
      'publications=1 проверяет число публикаций. Их неизменная identity требует trackSid в video metrics или отдельной проверки.',
      'A/V offset, физический вывод звука и voice RTP этим анализом не проверяются.',
    ],
  };
}

module.exports = { evaluateMediaAcceptance, MEDIA_PROFILES };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const sample = elapsedMs => ({
    elapsedMs,
    a: { trackSid: 'audio-a', totalSamplesReceived: elapsedMs * 48, at: elapsedMs + 100 },
    b: { trackSid: 'audio-b', totalSamplesReceived: elapsedMs * 48, at: elapsedMs + 3000 },
    videoA: { framesDecoded: elapsedMs * 15 / 1000, at: elapsedMs + 500, fresh: true, width: 1280, height: 720, publications: 1 },
    videoB: { framesDecoded: elapsedMs * 15 / 1000, at: elapsedMs + 9000, fresh: true, width: 1280, height: 720, publications: 1 },
  });
  const complete = Array.from({ length: 301 }, (_, index) => sample(index * 2000));
  assert.equal(evaluateMediaAcceptance(complete).sustainedStatus, 'PASS');
  const short = evaluateMediaAcceptance(complete.slice(0, 11), { requiredDurationMs: 20000 });
  assert.equal(short.status, 'PASS'); assert.equal(short.sustainedStatus, 'NOT VERIFIED');
  assert.equal(evaluateMediaAcceptance(complete.slice(1)).duration.status, 'FAIL');
  const slow = complete.map(value => ({ ...value, videoB: { ...value.videoB, framesDecoded: value.elapsedMs * 14 / 1000 } }));
  assert.equal(evaluateMediaAcceptance(slow).video.b.status, 'FAIL');
  assert.equal(evaluateMediaAcceptance(slow).video.a.status, 'PASS');
  const rotation = structuredClone(complete); rotation[5].a.trackSid = 'replacement';
  assert(evaluateMediaAcceptance(rotation).audio.a.issues.some(issue => issue.reason === 'audio_track_rotated'));
  const stall = structuredClone(complete); stall[5].a.totalSamplesReceived = stall[4].a.totalSamplesReceived;
  assert(evaluateMediaAcceptance(stall).audio.a.issues.some(issue => issue.reason === 'audio_counter_stalled'));
  const reset = structuredClone(complete); reset[5].videoA.framesDecoded = 0;
  assert(evaluateMediaAcceptance(reset).video.a.issues.some(issue => issue.reason === 'video_counter_regressed'));
  assert(evaluateMediaAcceptance(reset).video.a.windows.length > 1);
  const clock = structuredClone(complete); clock[5].videoA.at = clock[4].videoA.at;
  assert(evaluateMediaAcceptance(clock).video.a.issues.some(issue => issue.reason === 'video_clock_regressed_or_stalled'));
  const missing = structuredClone(complete); missing[5] = null; missing[6].videoA = null; missing[7].b = null;
  assert.equal(evaluateMediaAcceptance(missing).status, 'FAIL');
  const gap = complete.filter((_, index) => index < 5 || index > 8);
  assert.equal(evaluateMediaAcceptance(gap).status, 'FAIL');
  const malformed = structuredClone(complete); malformed[5].videoB.width = null; malformed[6].videoB.publications = 2;
  assert.equal(evaluateMediaAcceptance(malformed).video.b.status, 'FAIL');
  const smooth30 = Array.from({ length: 301 }, (_, index) => {
    const elapsedMs = index * 2000;
    return { elapsedMs,
      a: { trackSid: 'audio-a', totalSamplesReceived: elapsedMs * 48, at: elapsedMs + 100 },
      b: { trackSid: 'audio-b', totalSamplesReceived: elapsedMs * 48, at: elapsedMs + 3000 },
      videoA: { framesDecoded: elapsedMs * 30 / 1000, at: elapsedMs + 500, fresh: true, width: 1280, height: 720, publications: 1 },
      videoB: { framesDecoded: elapsedMs * 30 / 1000, at: elapsedMs + 9000, fresh: true, width: 1280, height: 720, publications: 1 },
    };
  });
  assert.equal(evaluateMediaAcceptance(smooth30, { profile: '720p30' }).status, 'PASS');
  const smooth60 = structuredClone(smooth30).map(sample => ({ ...sample,
    videoA: { ...sample.videoA, framesDecoded: sample.elapsedMs * 60 / 1000 },
    videoB: { ...sample.videoB, framesDecoded: sample.elapsedMs * 60 / 1000 },
  }));
  assert.equal(evaluateMediaAcceptance(smooth60, { profile: '720p60' }).status, 'PASS');
  assert.equal(evaluateMediaAcceptance(smooth30, { profile: '1080p30' }).video.a.issues[0].reason, 'video_resolution_mismatch');
  assert.throws(() => evaluateMediaAcceptance(complete, { profile: '2160p60' }), /Unsupported media profile/);
  for (const values of [null, [], [null], [{ elapsedMs: 1, videoA: {} }]]) assert.equal(evaluateMediaAcceptance(values).status, 'FAIL');
  console.log('Media acceptance self-check: PASS');
}
