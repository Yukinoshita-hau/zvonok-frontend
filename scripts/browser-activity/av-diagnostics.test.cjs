'use strict';

const assert = require('node:assert/strict');
const { analyzeEvents } = require('./av-diagnostics.cjs');
const { encodeAudio, detectAudio, encodeVisual, decodeVisual, matchIdentifiedEvents } = require('./av-event-codec.cjs');

const result = analyzeEvents({
  audio: [1000, 3000, 3000.2, 7000, 9000], // cycle 2 is missing; cycle 1 was detected twice
  video: [900, 2900, 4900, 6900, 8900],
});
assert.equal(result.pairedEvents, 3);
assert.equal(result.duplicates.audio.length, 2);
assert.equal(result.unmatchedAudio.length, 2);
assert.equal(result.unmatchedVideo.length, 2); // one missing audio cycle and one ambiguous duplicate slot
assert(result.pairs.every(pair => pair.eventId.startsWith('cadence:')));
assert(result.pairs.every(pair => pair.offsetMs === -100));
assert.equal(result.absoluteOffsetMs.over600Ms, 0);
assert.equal(result.coverage.expectedCadenceSlots, 5);

const outlier = analyzeEvents({ audio: [0, 2000, 4000], video: [800, 2800, 4800] });
assert.equal(outlier.pairedEvents, 3);
assert.equal(outlier.absoluteOffsetMs.p95, 800); // no outlier is silently dropped
assert.equal(outlier.absoluteOffsetMs.over600Ms, 3);

const reordered = analyzeEvents({
  audio: [4000, 0, 8000, 2000, 6000],
  video: [6100, 100, 8100, 4220, 2100], // event 2 is delayed by 120ms
});
assert.equal(reordered.pairedEvents, 5);
assert.deepEqual(reordered.pairs.map(pair => pair.eventId), ['cadence:0', 'cadence:1', 'cadence:2', 'cadence:3', 'cadence:4']);
assert.deepEqual(reordered.pairs.map(pair => pair.offsetMs), [100, 100, 220, 100, 100]);
assert.equal(reordered.signedOffsetMs.p95, 220);
assert.equal(reordered.coverage.pairedOverExpectedCadenceSlots, 1);
process.stdout.write('A/V cadence diagnostic self-check PASS\n');

// Decode identifiers from the generated signal samples themselves, not from event order or cadence.
const id = 0x5a3c;
const pcm = encodeAudio(id, { sampleRate: 48000 });
const noisy = pcm.map((sample, i) => Math.max(-1, Math.min(1, sample * 0.72 + 0.025 * Math.sin(i * 0.37))));
const audioDecoded = detectAudio(noisy, 48000);
assert.deepEqual(audioDecoded.events.map(event => event.eventId), [id]);
assert.equal(audioDecoded.invalid.length, 0);
const unalignedPcm=new Float32Array(48000);
unalignedPcm.set(encodeAudio(42),18*48);
assert.deepEqual(detectAudio(unalignedPcm).events.map(event=>event.eventId),[42]); // a weak early candidate must not skip the valid preamble
const ambiguousPcm = encodeAudio(id, { sampleRate: 48000 });
for (let i = 0; i < 1920; i++) ambiguousPcm[i] = 0.175 * Math.sin(2 * Math.PI * 2600 * i / 48000) + 0.175 * Math.sin(2 * Math.PI * 2800 * i / 48000);
assert.equal(detectAudio(ambiguousPcm, 48000).ambiguous[0]?.reason, 'weak-audio-preamble');
const damagedPcm = encodeAudio(id, { sampleRate: 48000 });
damagedPcm.fill(0, 6 * 1920, 7 * 1920); // destroy one encoded dibit; CRC must reject it
assert.equal(detectAudio(damagedPcm, 48000).invalid[0]?.reason, 'crc-mismatch');
const silentPayload=encodeAudio(0);
silentPayload.fill(0,4*1920);
assert.equal(detectAudio(silentPayload).events.length,0); // silence decodes as zero dibits and must not pass CRC for ID 0
assert.equal(detectAudio(silentPayload).ambiguous[0]?.reason,'weak-audio-payload');
const pixels = encodeVisual(id).map((v, i) => Math.max(0, Math.min(1, v + ((i % 5) - 2) * 0.035)));
assert.equal(decodeVisual(pixels).eventId, id); // lossy quantization/noise leaves the repeated majority intact
assert.equal(decodeVisual(new Float32Array(72).fill(0.5)).status, 'ambiguous');
const corrupt = [...pixels]; corrupt.fill(0, 8, 20);
assert.equal(decodeVisual(corrupt).reason, 'crc-mismatch');
for (const eventId of [0,1,2,3,4,5]) assert.equal(decodeVisual(encodeVisual(eventId)).eventId,eventId);

const matched = matchIdentifiedEvents({
  audio: [id, 2, 3, id].map((eventId, i) => ({ eventId, at: 1000 + i * 2000 })),
  video: [id, 99, 2].map((eventId, i) => ({ eventId, at: 1100 + i * 2000 })),
  invalidAudio: [{ at: 9000, reason: 'crc' }], invalidVideo: [{ at: 9100, reason: 'crc' }],
});
assert.equal(matched.pairs.length, 1);
assert.equal(matched.pairs[0].eventId, 2); // detection order differs; identity does not
assert.equal(matched.duplicates.audio.length, 2);
assert.deepEqual(matched.missingAudio.map(event => event.eventId), [99]);
assert.deepEqual(matched.missingVideo.map(event => event.eventId), [3]);
assert.equal(matched.invalidAudio.length, 1);
assert.equal(matched.unmatchedAudio.length, 1); // audio-only event remains visible as unmatched
assert(matched.pairs.some(pair => Math.abs(pair.offsetMs) > 600));
assert.equal(matched.pairs[0].offsetMs, 2100); // delayed video stays signed and is not outlier-filtered
assert.equal(matched.pairs[0].absoluteOffsetMs, 2100);
assert.equal(matched.signedOffsetMs.max, 2100);
assert.equal(matched.status, 'INCONCLUSIVE');
assert.equal(matched.absoluteOffsetMs.p50, 2100);
assert.equal(matched.absoluteOffsetMs.p95, 2100);
assert.equal(matched.coverage.video, 1/3);
const delayedAudio = matchIdentifiedEvents({ audio: [{ eventId: 41, at: 1725 }], video: [{ eventId: 41, at: 1000 }] });
assert.equal(delayedAudio.pairs[0].offsetMs, -725); // delayed audio remains a negative signed offset
assert.equal(delayedAudio.pairs[0].absoluteOffsetMs, 725);
assert.equal(delayedAudio.signedOffsetMs.p50, -725);
process.stdout.write('A/V signal-content identity codec self-check PASS\n');
