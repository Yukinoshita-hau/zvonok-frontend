import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";


export async function processTrackWithRnnoise(
    track: MediaStreamTrack
): Promise<MediaStreamTrack> {

    const audioContext = new AudioContext();

    const wasmBinary = await loadRnnoise({
        url: rnnoiseWasmPath,
        simdUrl: rnnoiseSimdWasmPath
    });

    await audioContext.audioWorklet.addModule(
        rnnoiseWorkletPath
    );

    const source = audioContext.createMediaStreamSource(
        new MediaStream([track])
    );

    const rnnoiseNode =
        new RnnoiseWorkletNode(audioContext, {
            wasmBinary,
            maxChannels: 1
        });

    const destination =
        audioContext.createMediaStreamDestination();

    source.connect(rnnoiseNode);
    rnnoiseNode.connect(destination);

	console.log(destination.stream.getAudioTracks())
    return destination.stream.getAudioTracks()[0];
}
