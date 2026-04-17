import { AudioTrack, useTracks } from "@livekit/components-react";
import { RemoteTrackPublication, Track } from "livekit-client";
import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";

export function CallAudioLayer() {
	const selectedScreenTrackSid = useSelector(
		(s: RootState) => s.call.selectedScreenTrackSid
	);
	const microphoneTracks = useTracks([Track.Source.Microphone]);
	const screenTracks = useTracks([Track.Source.ScreenShare], {
		onlySubscribed: false,
	});
	const screenAudioTracks = useTracks([Track.Source.ScreenShareAudio], {
		onlySubscribed: false,
	});

	const selectedScreenParticipantIdentity = useMemo(() => {
		if (!selectedScreenTrackSid) return null;

		return (
			screenTracks.find(
				(trackRef) => trackRef.publication.trackSid === selectedScreenTrackSid
			)?.participant.identity ?? null
		);
	}, [screenTracks, selectedScreenTrackSid]);

	useEffect(() => {
		screenAudioTracks.forEach((trackRef) => {
			const publication = trackRef.publication;
			if (!(publication instanceof RemoteTrackPublication)) return;

			const shouldSubscribe =
				trackRef.participant.identity === selectedScreenParticipantIdentity;
			if (publication.isDesired !== shouldSubscribe) {
				publication.setSubscribed(shouldSubscribe);
			}
		});
	}, [screenAudioTracks, selectedScreenParticipantIdentity]);

	const audioTracks = useMemo(
		() => [
			...microphoneTracks,
			...screenAudioTracks.filter(
				(trackRef) =>
					trackRef.participant.identity === selectedScreenParticipantIdentity
			),
		],
		[microphoneTracks, screenAudioTracks, selectedScreenParticipantIdentity]
	);

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
