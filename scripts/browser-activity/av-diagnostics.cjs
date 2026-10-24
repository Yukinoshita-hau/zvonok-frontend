'use strict';

function wrap(value, period) { return ((value + period / 2) % period + period) % period - period / 2; }
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
function regressionSlope(points) {
  if (points.length < 2) return null;
  const x = points.map(p => p.at), y = points.map(p => p.offsetMs);
  const mx = x.reduce((a, b) => a + b, 0) / x.length, my = y.reduce((a, b) => a + b, 0) / y.length;
  const den = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  return den ? x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / den * 60000 : null;
}

function analyzeEvents({ audio, video, periodMs = 2000 }) {
  if (!Number.isFinite(periodMs) || periodMs <= 0 || !Array.isArray(audio) || !Array.isArray(video)) throw Error('Invalid event input');
  const clean = events => events.map((event, index) => ({ at: typeof event === 'number' ? event : event?.at, index }))
    .filter(event => Number.isFinite(event.at)).sort((a, b) => a.at - b.at);
  const a = clean(audio), v = clean(video);
  if (!a.length || !v.length) return { periodMs, status: 'INSUFFICIENT_EVENTS', audioDetected: a.length, videoDetected: v.length, pairs: [], unmatchedAudio: a, unmatchedVideo: v, duplicates: { audio: [], video: [] } };

  // The fixture repeats on a fixed AudioContext cadence; phase identifies a cycle without nearest-neighbor pairing.
  let sin = 0, cos = 0;
  for (const ae of a) for (const ve of v) {
    const angle = wrap(ve.at - ae.at, periodMs) / periodMs * 2 * Math.PI;
    sin += Math.sin(angle); cos += Math.cos(angle);
  }
  const phaseMs = wrap(Math.atan2(sin, cos) / (2 * Math.PI) * periodMs, periodMs);
  const origin = a[0].at;
  const slotEvents = (events, phase) => {
    const slots = new Map();
    for (const event of events) {
      const slot = Math.round((event.at - origin - phase) / periodMs);
      const residualMs = event.at - (origin + phase + slot * periodMs);
      const item = { ...event, slot, residualMs, confidence: Math.abs(residualMs) <= 100 ? 'high' : Math.abs(residualMs) <= 250 ? 'medium' : 'low' };
      if (!slots.has(slot)) slots.set(slot, []);
      slots.get(slot).push(item);
    }
    return slots;
  };
  const as = slotEvents(a, 0), vs = slotEvents(v, phaseMs), pairs = [], unmatchedAudio = [], unmatchedVideo = [], duplicates = { audio: [], video: [] };
  const allSlots = [...new Set([...as.keys(), ...vs.keys()])].sort((x, y) => x - y);
  for (const slot of allSlots) {
    const aa = as.get(slot) || [], vv = vs.get(slot) || [];
    if (aa.length > 1) duplicates.audio.push(...aa.map(e => ({ ...e, reason: 'multiple detections in cadence slot' })));
    if (vv.length > 1) duplicates.video.push(...vv.map(e => ({ ...e, reason: 'multiple detections in cadence slot' })));
    if (aa.length === 1 && vv.length === 1) {
      const offsetMs = vv[0].at - aa[0].at;
      pairs.push({ eventId: `cadence:${slot}`, audioAt: aa[0].at, videoAt: vv[0].at, offsetMs, absOffsetMs: Math.abs(offsetMs), confidence: aa[0].confidence === 'low' || vv[0].confidence === 'low' ? 'low' : aa[0].confidence === 'medium' || vv[0].confidence === 'medium' ? 'medium' : 'high' });
    } else {
      unmatchedAudio.push(...aa.map(e => ({ ...e, reason: aa.length > 1 ? 'duplicate cadence slot' : vv.length > 1 ? 'video duplicate makes correspondence ambiguous' : 'no video event in cadence slot' })));
      unmatchedVideo.push(...vv.map(e => ({ ...e, reason: vv.length > 1 ? 'duplicate cadence slot' : aa.length > 1 ? 'audio duplicate makes correspondence ambiguous' : 'no audio event in cadence slot' })));
    }
  }
  const offsets = pairs.map(p => p.offsetMs), absolute = pairs.map(p => p.absOffsetMs);
  const expectedSlots = allSlots.length ? allSlots.at(-1) - allSlots[0] + 1 : 0;
  return {
    methodology: 'one-to-one cadence-slot correspondence; cycle inferred from the known 2000ms fixture cadence and cross-stream phase, not encoded source IDs',
    periodMs, inferredVideoPhaseMs: phaseMs,
    audioDetected: a.length, videoDetected: v.length, pairedEvents: pairs.length,
    coverage: { pairedOverExpectedCadenceSlots: expectedSlots ? pairs.length / expectedSlots : 0, expectedCadenceSlots: expectedSlots, pairedOverMinDetected: Math.min(a.length, v.length) ? pairs.length / Math.min(a.length, v.length) : 0 },
    confidence: { high: pairs.filter(p => p.confidence === 'high').length, medium: pairs.filter(p => p.confidence === 'medium').length, low: pairs.filter(p => p.confidence === 'low').length },
    pairs, unmatchedAudio, unmatchedVideo, duplicates,
    signedOffsetMs: { p50: percentile(offsets, .5), p95: percentile(offsets, .95), p99: percentile(offsets, .99), min: offsets.length ? Math.min(...offsets) : null, max: offsets.length ? Math.max(...offsets) : null, mean: offsets.length ? offsets.reduce((s, x) => s + x, 0) / offsets.length : null, driftMsPerMinute: regressionSlope(pairs.map(p => ({ at: p.audioAt, offsetMs: p.offsetMs }))) },
    absoluteOffsetMs: { p50: percentile(absolute, .5), p95: percentile(absolute, .95), p99: percentile(absolute, .99), over150Ms: absolute.filter(x => x > 150).length, over600Ms: absolute.filter(x => x > 600).length, max: absolute.length ? Math.max(...absolute) : null },
    limitations: ['Cadence slot is an inferred identity, not a source-encoded event ID.', 'This detects receiver event timing, not physical speaker/display synchronization.'],
  };
}

module.exports = { analyzeEvents };

if (require.main === module) {
  const fs = require('node:fs');
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const output = Object.fromEntries(Object.entries(input).filter(([, value]) => Array.isArray(value?.audio) && Array.isArray(value?.video)).map(([key, value]) => [key, analyzeEvents(value)]));
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}
