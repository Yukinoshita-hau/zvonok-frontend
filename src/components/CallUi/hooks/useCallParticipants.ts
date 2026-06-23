import { useParticipants, useTracks, isTrackReference, type TrackReference } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../store/store";
import type { UserMini } from "../../../entities/UserMini";

export interface ParticipantCard {
	/** Уникальный id карточки: sid трансляции или identity участника. */
	id: string;
	participant: Participant;
	/** Видео-трек для карточки: камера или трансляция экрана. */
	videoTrack?: TrackReference;
	/** Трансляция экрана отображается отдельной карточкой. */
	isScreenShareCard: boolean;
	displayName: string;
	avatarUrl: string | null;
}

export function useCallParticipants() {
	const call = useSelector((s: RootState) => s.call);
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const rooms = useSelector((s: RootState) => s.room.rooms);
	const usersById = useSelector((s: RootState) => s.users.byId);

	const participants = useParticipants();

	const videoTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
	const microphoneAudioTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);
	const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
	const screenAudioTracks = useTracks([{ source: Track.Source.ScreenShareAudio, withPlaceholder: false }]);

	const currentRoom = useMemo(
		() => rooms.find((room) => room.id === call.chatRoomId) ?? null,
		[rooms, call.chatRoomId]
	);

	const currentRoomMembers = useMemo(() => {
		if (!currentRoom) return [];
		return (currentRoom.memberIds ?? [])
			.map((memberId) => usersById[memberId])
			.filter((v): v is UserMini => Boolean(v));
	}, [currentRoom, usersById]);

	const participantAvatarResolver = useMemo(() => {
		const avatarsByKey = new Map<string, string | null>();
		const normalizedMyUser = myUser?.id ? usersById[myUser.id] ?? myUser : myUser;
		const remoteMembers = currentRoomMembers.filter((member) => member.id !== myUser?.id);

		if (normalizedMyUser?.username) {
			const key = normalizedMyUser.username.trim().toLowerCase();
			avatarsByKey.set(key, normalizedMyUser.avatarUrl ?? null);
			avatarsByKey.set(String(normalizedMyUser.id), normalizedMyUser.avatarUrl ?? null);
		}

		currentRoomMembers.forEach((member) => {
			const key = member.username.trim().toLowerCase();
			avatarsByKey.set(key, member.avatarUrl ?? null);
			avatarsByKey.set(String(member.id), member.avatarUrl ?? null);
		});

		return (identity: string, isLocal: boolean) => {
			if (isLocal) return normalizedMyUser?.avatarUrl ?? null;
			const normalizedIdentity = identity.trim().toLowerCase();
			const exactAvatar = avatarsByKey.get(normalizedIdentity);
			if (exactAvatar !== undefined) return exactAvatar;

			const matchedMember = remoteMembers.find((member) => {
				const normalizedUsername = member.username.trim().toLowerCase();
				return normalizedIdentity.includes(normalizedUsername) || normalizedUsername.includes(normalizedIdentity);
			});
			if (matchedMember) return matchedMember.avatarUrl ?? null;
			if (remoteMembers.length === 1) return remoteMembers[0].avatarUrl ?? null;
			return null;
		};
	}, [currentRoomMembers, myUser, usersById]);

	const availableScreenTracks = useMemo(
		() => screenTracks.filter((trackRef) => trackRef.publication && !trackRef.publication.isMuted),
		[screenTracks]
	);

	const subscribedVideoTracks = useMemo(
		() => videoTracks.filter((trackRef) =>
			trackRef.publication &&
			(trackRef.participant.isLocal || trackRef.publication.isSubscribed) &&
			!trackRef.publication.isMuted
		).filter(isTrackReference),
		[videoTracks]
	);

	const remoteMicrophoneParticipants = useMemo(() => {
		const participantSet = new Set<string>();
		microphoneAudioTracks.forEach((trackRef) => {
			if (trackRef.participant.isLocal) return;
			if (!trackRef.publication || trackRef.publication.isMuted) return;
			participantSet.add(trackRef.participant.identity);
		});
		return participantSet;
	}, [microphoneAudioTracks]);

	const remoteScreenAudioParticipants = useMemo(() => {
		const participantSet = new Set<string>();
		screenAudioTracks.forEach((trackRef) => {
			if (trackRef.participant.isLocal) return;
			if (!trackRef.publication || trackRef.publication.isMuted) return;
			participantSet.add(trackRef.participant.identity);
		});
		return participantSet;
	}, [screenAudioTracks]);

	const videoTrackByParticipant = useMemo(() => {
		const trackMap = new Map<string, TrackReference>();
		subscribedVideoTracks.forEach((trackRef) => {
			trackMap.set(trackRef.participant.identity, trackRef);
		});
		return trackMap;
	}, [subscribedVideoTracks]);

	const screenTrackByParticipant = useMemo(() => {
		const trackMap = new Map<string, TrackReference>();
		availableScreenTracks.forEach((trackRef) => {
			if (!isTrackReference(trackRef)) return;
			trackMap.set(trackRef.participant.identity, trackRef);
		});
		return trackMap;
	}, [availableScreenTracks]);

	const sortedParticipants = useMemo(
		() => [...participants].sort((left, right) => {
			if (left.isLocal !== right.isLocal) return left.isLocal ? -1 : 1;
			return left.identity.localeCompare(right.identity);
		}),
		[participants]
	);

	const participantCards = useMemo<ParticipantCard[]>(() => {
		const cards: ParticipantCard[] = [];
		sortedParticipants.forEach((participant) => {
			const avatarUrl = participantAvatarResolver(participant.identity, participant.isLocal);
			const displayName = participant.name || participant.identity;

			cards.push({
				id: participant.identity,
				participant,
				videoTrack: videoTrackByParticipant.get(participant.identity),
				isScreenShareCard: false,
				displayName,
				avatarUrl,
			});

			const screenTrack = screenTrackByParticipant.get(participant.identity);
			const screenSid = screenTrack?.publication?.trackSid;
			if (screenTrack && screenSid) {
				cards.push({
					id: `screen:${screenSid}`,
					participant,
					videoTrack: screenTrack,
					isScreenShareCard: true,
					displayName: `Трансляция ${displayName}`,
					avatarUrl,
				});
			}
		});
		return cards;
	}, [sortedParticipants, videoTrackByParticipant, screenTrackByParticipant, participantAvatarResolver]);

	const participantCardByIdentity = useMemo(() => {
		const map = new Map<string, { avatarUrl: string | null; displayName: string }>();
		participantCards.forEach(({ participant, avatarUrl, isScreenShareCard }) => {
			if (isScreenShareCard) return;
			map.set(participant.identity, {
				avatarUrl,
				displayName: participant.name || participant.identity,
			});
		});
		return map;
	}, [participantCards]);

	return {
		participantCards,
		sortedParticipants,
		remoteMicrophoneParticipants,
		remoteScreenAudioParticipants,
		participantCardByIdentity,
		availableScreenTracks,
		subscribedVideoTracks,
	};
}
