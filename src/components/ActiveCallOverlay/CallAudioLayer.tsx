import { AudioTrack, useTracks } from "@livekit/components-react";
import {
	RemoteAudioTrack,
	RemoteTrackPublication,
	Track,
} from "livekit-client";
import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import type { ParticipantAudioSource } from "../../store/slices/device.slice";

export function CallAudioLayer() {
	const selectedScreenTrackSid = useSelector(
		(s: RootState) => s.call.selectedScreenTrackSid
	);
	const participantVolumes = useSelector(
		(s: RootState) => s.device.participantVolumes
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

	useEffect(() => {
		audioTracks.forEach((trackRef) => {
			const publication = trackRef.publication;
			const track = publication?.track;
			if (!(track instanceof RemoteAudioTrack)) return;
			if (trackRef.participant.isLocal) return;

			const source = toAudioSource(trackRef.source ?? publication?.source);
			if (!source) return;

			const preference = participantVolumes.find(
				(item) =>
					item.participantIdentity === trackRef.participant.identity &&
					item.source === source
			);
			const volume = preference?.volume ?? 100;
			track.setVolume(Math.max(0, Math.min(1, volume / 100)));
		});
	}, [audioTracks, participantVolumes]);

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

function toAudioSource(trackSource: Track.Source | undefined): ParticipantAudioSource | null {
	if (trackSource === Track.Source.Microphone) return "microphone";
	if (trackSource === Track.Source.ScreenShareAudio) return "screenShareAudio";
	return null;
}
