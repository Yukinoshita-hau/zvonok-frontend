import {
	LocalAudioTrack,
	ConnectionState,
	Track,
	type AudioCaptureOptions,
	type LocalTrack,
	type Room,
} from "livekit-client";
import type { TrackPublishOptions } from "livekit-client";

export type MicrophoneOwnerAdapter<TTrack, TCapture, TPublish> = {
	isConnected: () => boolean;
	isCallCurrent: () => boolean;
	getPublication: () => { track?: TTrack; mute: () => Promise<unknown>; unmute: () => Promise<unknown> } | undefined;
	createTracks: (capture: TCapture) => Promise<TTrack[]>;
	isAudioTrack: (track: TTrack) => boolean;
	stop: (track: TTrack) => void;
	publish: (track: TTrack, options: TPublish) => Promise<unknown>;
	unpublish: (track: TTrack) => Promise<unknown>;
};

/** Owns only microphone tracks created or adopted for one Room/call generation. */
export class MicrophoneCaptureOwner<TTrack, TCapture, TPublish> {
	readonly callId: number | string;
	readonly mediaGeneration: number;
	private readonly adapter: MicrophoneOwnerAdapter<TTrack, TCapture, TPublish>;
	private disposed = false;
	private desiredEnabled = false;
	private revision = 0;
	private pending: Promise<void> | null = null;
	private ownedTracks = new Set<TTrack>();
	private pendingTrack: TTrack | null = null;
	private unpublishRequested = new Set<TTrack>();
	private latestOptions: { capture: TCapture; publish: TPublish } | null = null;

	constructor(
		callId: number | string,
		mediaGeneration: number,
		adapter: MicrophoneOwnerAdapter<TTrack, TCapture, TPublish>,
	) {
		this.callId = callId;
		this.mediaGeneration = mediaGeneration;
		this.adapter = adapter;
	}

	setEnabled(enabled: boolean, capture: TCapture, publish: TPublish): Promise<void> {
		if (this.disposed) return Promise.resolve();
		if (!enabled) {
			this.desiredEnabled = false;
			this.revision++;
			const pendingTrack = this.pendingTrack;
			if (pendingTrack) {
				this.stop(pendingTrack);
			this.requestUnpublish(pendingTrack);
			}
			const publication = this.adapter.getPublication();
			if (publication?.track && publication.track !== pendingTrack) {
				this.ownedTracks.add(publication.track);
				return Promise.resolve(publication.mute()).then(() => undefined);
			}
			return Promise.resolve();
		}

		this.desiredEnabled = true;
		this.latestOptions = { capture, publish };
		if (!this.adapter.isCallCurrent() || !this.adapter.isConnected()) return Promise.resolve();
		const publication = this.adapter.getPublication();
		if (publication?.track) {
			this.ownedTracks.add(publication.track);
			return Promise.resolve(publication.unmute()).then(() => undefined);
		}
		if (this.pending) return this.pending;

		const revision = ++this.revision;
		const task = this.captureAndPublish(revision, capture, publish);
		const wrapped = task.finally(() => {
			if (this.pending === wrapped) this.pending = null;
			if (this.revision === revision) this.pendingTrack = null;
			const latest = this.latestOptions;
			if (this.revision !== revision && this.desiredEnabled && !this.disposed && latest && !this.adapter.getPublication()?.track) {
				void this.setEnabled(true, latest.capture, latest.publish);
			}
		});
		this.pending = wrapped;
		return wrapped;
	}

	updateOptions(capture: TCapture, publish: TPublish): void {
		this.latestOptions = { capture, publish };
		if (!this.pending || !this.desiredEnabled || this.disposed) return;
		this.revision++;
		if (this.pendingTrack) {
			this.stop(this.pendingTrack);
			this.requestUnpublish(this.pendingTrack);
		}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.desiredEnabled = false;
		this.revision++;
		const currentPublication = this.adapter.getPublication();
		if (currentPublication?.track) this.ownedTracks.add(currentPublication.track);
		for (const track of this.ownedTracks) {
			this.stop(track);
			this.requestUnpublish(track);
		}
		this.ownedTracks.clear();
		this.pendingTrack = null;
	}

	private async captureAndPublish(revision: number, capture: TCapture, publish: TPublish): Promise<void> {
		let tracks: TTrack[] = [];
		try {
			tracks = await this.adapter.createTracks(capture);
			for (const track of tracks) this.ownedTracks.add(track);
			const audioTrack = tracks.find((track) => this.adapter.isAudioTrack(track));
			if (!audioTrack) throw new Error("LiveKit did not create a microphone track");
			this.pendingTrack = audioTrack;
			if (!this.isCurrent(revision) || !this.adapter.isConnected()) {
				this.stopAll(tracks);
				return;
			}

			await this.adapter.publish(audioTrack, publish);
			if (!this.isCurrent(revision) || !this.adapter.isConnected()) {
				this.stop(audioTrack);
				this.requestUnpublish(audioTrack);
			}
		} catch (error) {
			this.stopAll(tracks);
			if (this.isCurrent(revision)) throw error;
		}
	}

	private isCurrent(revision: number): boolean {
		return !this.disposed && this.desiredEnabled && this.revision === revision && this.adapter.isCallCurrent();
	}

	private stopAll(tracks: TTrack[]): void {
		for (const track of tracks) this.stop(track);
	}

	private stop(track: TTrack): void {
		if (!this.ownedTracks.has(track)) return;
		try {
			this.adapter.stop(track);
		} finally {
			this.ownedTracks.delete(track);
		}
	}

	private requestUnpublish(track: TTrack): void {
		if (this.unpublishRequested.has(track)) return;
		this.unpublishRequested.add(track);
		void this.adapter.unpublish(track).catch(() => undefined);
	}
}

export function createLiveKitMicrophoneOwner(room: Room, callId: number | string, generation: number, isCallCurrent: () => boolean) {
	return new MicrophoneCaptureOwner<LocalTrack, AudioCaptureOptions, TrackPublishOptions>(
		callId,
		generation,
		{
			isConnected: () => room.state === ConnectionState.Connected,
			isCallCurrent,
			getPublication: () => room.localParticipant.getTrackPublication(Track.Source.Microphone),
			createTracks: (capture) => room.localParticipant.createTracks({ audio: capture, video: false }),
			isAudioTrack: (track) => track instanceof LocalAudioTrack,
			stop: (track) => track.stop(),
			publish: (track, options) => room.localParticipant.publishTrack(track, options),
			unpublish: (track) => room.localParticipant.unpublishTrack(track, true),
		},
	);
}

