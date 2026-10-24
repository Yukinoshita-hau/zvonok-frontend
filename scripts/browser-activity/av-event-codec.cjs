'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AvEventCodec = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VIDEO_BITS = 24, VIDEO_REPETITIONS = 3, COLS = 12, ROWS = 6;
  const SYMBOL_MS = 40, TONE_LENGTH_MS = 30;
  const PREAMBLE = [2600, 2800, 3000, 3200], DATA_TONES = [1000, 1300, 1600, 1900];

  function bytesFor(id) {
    if (!Number.isInteger(id) || id < 0 || id > 0xffff) throw Error('event ID must be an unsigned 16-bit integer');
    const bytes = [id >> 8, id & 255]; let crc = 0;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 255 : (crc << 1) & 255; }
    return [...bytes, crc];
  }
  function bits(id) { return bytesFor(id).flatMap(byte => Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1)); }
  function bitsToId(input) {
    const bytes = [];
    for (let i = 0; i < 24; i += 8) bytes.push(input.slice(i, i + 8).reduce((v, bit) => (v << 1) | bit, 0));
    const id = bytes[0] * 256 + bytes[1];
    return bytes[2] === bytesFor(id)[2] ? id : null;
  }
  function encodeVisual(id) {
    const payload = bits(id), cells = [];
    for (const bit of payload) for (let i = 0; i < VIDEO_REPETITIONS; i++) cells.push(bit ? 0.94 : 0.06);
    return Float32Array.from(cells);
  }
  function decodeVisual(luma, at = null) {
    if (!luma || luma.length !== COLS * ROWS) return { status: 'invalid', reason: 'wrong-cell-count', at };
    const decoded = [], margins = [];
    for (let i = 0; i < VIDEO_BITS; i++) {
      const group = [luma[i * 3], luma[i * 3 + 1], luma[i * 3 + 2]].map(Number);
      if (group.some(v => !Number.isFinite(v) || v < 0 || v > 1)) return { status: 'invalid', reason: 'invalid-luminance', at };
      const sorted = [...group].sort((a, b) => a - b), middle = sorted[1];
      decoded.push(middle >= 0.5 ? 1 : 0); margins.push(Math.abs(middle - 0.5) * 2);
    }
    if (Math.min(...margins) < 0.2) return { status: 'ambiguous', reason: 'low-cell-contrast', confidence: Math.min(...margins), at };
    const eventId = bitsToId(decoded);
    if (eventId === null) return { status: 'invalid', reason: 'crc-mismatch', confidence: Math.min(...margins), at };
    return { status: 'decoded', eventId, confidence: Math.min(...margins), at, detectionLatencyMs: 1000 / 15, latencyUncertaintyMs: 1000 / 15 };
  }
  function goertzel(data, start, size, sampleRate, frequency) {
    const omega = 2 * Math.PI * frequency / sampleRate, coeff = 2 * Math.cos(omega);
    let s0, s1 = 0, s2 = 0;
    for (let i = 0; i < size; i++) { s0 = data[start + i] + coeff * s1 - s2; s2 = s1; s1 = s0; }
    return s1 * s1 + s2 * s2 - coeff * s1 * s2;
  }
  function toneAt(data, start, size, sampleRate, frequencies) {
    if (start < 0 || start + size > data.length) return null;
    const energy = frequencies.map(f => goertzel(data, start, size, sampleRate, f));
    const order = energy.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    return { index: order[0][1], confidence: order[0][0] / Math.max(1e-20, energy.reduce((a, b) => a + b, 0)), ratio: order[0][0] / Math.max(1e-20, order[1][0]) };
  }
  function encodeAudio(id, { sampleRate = 48000, amplitude = 0.35 } = {}) {
    const payload = bits(id), dibits = [];
    for (let i = 0; i < payload.length; i += 2) dibits.push(payload[i] * 2 + payload[i + 1]);
    const tones = [...PREAMBLE, ...dibits.map(bit => DATA_TONES[bit])], perSymbol = Math.round(sampleRate * SYMBOL_MS / 1000);
    const pcm = new Float32Array(tones.length * perSymbol);
    tones.forEach((frequency, symbol) => {
      const start = symbol * perSymbol;
      for (let i = 0; i < perSymbol; i++) {
        const edge = Math.min(1, i / (sampleRate * 0.004), (perSymbol - i) / (sampleRate * 0.004));
        pcm[start + i] = amplitude * Math.max(0, edge) * Math.sin(2 * Math.PI * frequency * i / sampleRate);
      }
    });
    return pcm;
  }
  function decodeAudioAt(data, sampleRate, start) {
    const size = Math.round(sampleRate * TONE_LENGTH_MS / 1000), step = Math.round(sampleRate * SYMBOL_MS / 1000);
    const preamble = PREAMBLE.map((_, i) => toneAt(data, start + i * step + Math.round(sampleRate * 0.005), size, sampleRate, PREAMBLE));
    if (preamble.some(v => !v)) return null;
    const preambleMatches = preamble.filter((v, i) => v.index === i && v.confidence >= 0.35).length;
    if (preambleMatches !== PREAMBLE.length || preamble.some(v => v.confidence < 0.58 || v.ratio < 2.5))
      return preambleMatches >= 3 ? { status: 'ambiguous', reason: 'weak-audio-preamble', confidence: Math.min(...preamble.map(x => x.confidence)) } : null;
    const decoded = [], scores = [...preamble.map(x => x.confidence)];
    for (let i = 0; i < 12; i++) {
      const tone = toneAt(data, start + (4 + i) * step + Math.round(sampleRate * 0.005), size, sampleRate, DATA_TONES);
      if (!tone) return { status: 'invalid', reason: 'truncated-audio-code', confidence: Math.min(...scores) };
      decoded.push((tone.index >> 1) & 1, tone.index & 1); scores.push(tone.confidence);
    }
    const id = bitsToId(decoded);
    return id === null
      ? { status: 'invalid', reason: 'crc-mismatch', confidence: Math.min(...scores) }
      : Math.min(...scores)<0.58
      ? { status: 'ambiguous', reason: 'weak-audio-payload', confidence: Math.min(...scores) }
      : { status: 'decoded', eventId: id, confidence: Math.min(...scores), detectionLatencyMs: SYMBOL_MS * 16, latencyUncertaintyMs: SYMBOL_MS };
  }
  function detectAudio(samples, sampleRate = 48000, { at = 0, scanStepMs = 5 } = {}) {
    if (!samples || !Number.isInteger(sampleRate) || sampleRate < 8000) throw Error('invalid audio input');
    const events = [], invalid = [], ambiguous = [], step = Math.max(1, Math.round(sampleRate * scanStepMs / 1000));
    for (let start = 0; start + Math.round(sampleRate * SYMBOL_MS * 16 / 1000) <= samples.length;) {
      const result = decodeAudioAt(samples, sampleRate, start);
      if (!result) { start += step; continue; }
      const record = { ...result, at: at + start * 1000 / sampleRate };
      (result.status === 'decoded' ? events : result.status === 'ambiguous' ? ambiguous : invalid).push(record);
      start += result.status === 'decoded' ? Math.round(sampleRate * SYMBOL_MS * 16 / 1000) : step;
    }
    return { events, invalid, ambiguous };
  }
  function matchIdentifiedEvents({ audio = [], video = [], invalidAudio = [], invalidVideo = [], ambiguousAudio = [], ambiguousVideo = [] }) {
    const indexed = records => {
      const map = new Map(); for (const event of records) { if (!Number.isInteger(event.eventId)) continue; if (!map.has(event.eventId)) map.set(event.eventId, []); map.get(event.eventId).push(event); }
      return map;
    };
    const a = indexed(audio), v = indexed(video), pairs = [], duplicates = { audio: [], video: [] }, ambiguous = [...ambiguousAudio.map(e => ({ ...e, mediaType: 'audio' })), ...ambiguousVideo.map(e => ({ ...e, mediaType: 'video' }))];
    for (const [media, map] of [['audio', a], ['video', v]]) for (const [eventId, found] of map) if (found.length > 1) duplicates[media].push(...found.map(event => ({ ...event, reason: 'duplicate-event-id' })));
    const missingAudio = [], missingVideo = [], unmatchedAudio = [], unmatchedVideo = [];
    for (const [eventId, foundVideo] of v) if (!a.has(eventId)) { missingAudio.push(...foundVideo); unmatchedVideo.push(...foundVideo); }
    for (const [eventId, foundAudio] of a) if (!v.has(eventId)) { missingVideo.push(...foundAudio); unmatchedAudio.push(...foundAudio); }
    for (const [eventId, foundAudio] of a) {
      const foundVideo = v.get(eventId) || [];
      if (foundAudio.length !== 1 || foundVideo.length !== 1) {
        if (foundVideo.length && foundAudio.length > 1) ambiguous.push({ eventId, reason: 'duplicate-audio-id' });
        if (foundAudio.length && foundVideo.length > 1) ambiguous.push({ eventId, reason: 'duplicate-video-id' });
        continue;
      }
      const audioEvent = foundAudio[0], videoEvent = foundVideo[0];
      const offsetMs = videoEvent.at - audioEvent.at;
      pairs.push({ eventId, audioAt: audioEvent.at, videoAt: videoEvent.at, audioDetectionAt: audioEvent.detectionAt ?? null, videoDetectionAt: videoEvent.detectionAt ?? null, audioDetectionLatencyMs: audioEvent.detectionAt == null ? null : audioEvent.detectionAt-audioEvent.at, videoDetectionLatencyMs: videoEvent.detectionAt == null ? null : videoEvent.detectionAt-videoEvent.at, offsetMs, absoluteOffsetMs: Math.abs(offsetMs), confidence: Math.min(audioEvent.confidence ?? 1, videoEvent.confidence ?? 1), latencyUncertaintyMs: (audioEvent.latencyUncertaintyMs || 0) + (videoEvent.latencyUncertaintyMs || 0) });
    }
    pairs.sort((x, y) => x.eventId - y.eventId);
    const offsets = pairs.map(p => p.offsetMs), percentile = (values, q = 95) => { const s = [...values].sort((x, y) => x - y); return s.length ? s[Math.max(0, Math.ceil(s.length * q / 100) - 1)] : null; };
    const meanTime=pairs.length?pairs.reduce((sum,p)=>sum+p.audioAt,0)/pairs.length:0,meanOffset=offsets.length?offsets.reduce((sum,x)=>sum+x,0)/offsets.length:0,denominator=pairs.reduce((sum,p)=>sum+(p.audioAt-meanTime)**2,0),driftMsPerMinute=denominator?pairs.reduce((sum,p)=>sum+(p.audioAt-meanTime)*(p.offsetMs-meanOffset),0)/denominator*60000:null;
    const absoluteP50=percentile(offsets.map(Math.abs),50),absoluteP95=percentile(offsets.map(Math.abs),95);
    return { status: pairs.length >= 20 ? 'MEASURED' : 'INCONCLUSIVE', minimumPairsForP95: 20, pairs, missingAudio, missingVideo, unmatchedAudio, unmatchedVideo, duplicates, invalidAudio, invalidVideo, ambiguous, signedOffsetMs: { p50: percentile(offsets,50), min: offsets.length ? Math.min(...offsets) : null, max: offsets.length ? Math.max(...offsets) : null }, absoluteOffsetMs: { p50: absoluteP50, p95: absoluteP95 }, p50AbsoluteMs: absoluteP50, p95AbsoluteMs: absoluteP95, uncertaintyMs: pairs.length ? Math.max(...pairs.map(p=>p.latencyUncertaintyMs)) : null, driftMsPerMinute, coverage: { matched: pairs.length, audioDetections: audio.length, videoDetections: video.length, audio: audio.length ? pairs.length/audio.length : 0, video: video.length ? pairs.length/video.length : 0 } };
  }
  return { COLS, ROWS, encodeAudio, detectAudio, encodeVisual, decodeVisual, matchIdentifiedEvents };
});
