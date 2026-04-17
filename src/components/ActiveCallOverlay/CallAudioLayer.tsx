import { AudioTrack, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";

export function CallAudioLayer() {
	const audioTracks = useTracks([
		{ source: Track.Source.Microphone, withPlaceholder: false },
		{ source: Track.Source.ScreenShareAudio, withPlaceholder: false },
	]);

	return (
		<div aria-hidden="true" style={{ display: "none" }}>
			{audioTracks.map((trackRef, index) => {
				const { publication, participant } = trackRef;
				if (!publication?.trackSid) return null;
				if (participant.isLocal) return null;
				if (!publication.isSubscribed || publication.isMuted) return null;
				if (publication.track?.isMuted) return null;

				return (
					<AudioTrack
						key={publication.trackSid ?? index}
						trackRef={trackRef}
					/>
				);
			})}
		</div>
	);
}
