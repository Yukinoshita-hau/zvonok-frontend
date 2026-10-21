import { useParticipants, useTracks, useConnectionState, isTrackReference, type TrackReference } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track, type Participant } from "livekit-client";
import { useEffect, useMemo, useRef } from "react";
import { createPresentation } from "../sourcePresentation";
import type { MediaSourcePresentation } from "../sourcePresentation";
import { mediaAspectRatio, stableCardOrder } from "../adaptiveLayout";
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
	aspectRatio?: number;
}

const mediaUpdates = [RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackSubscribed,
	RoomEvent.TrackUnsubscribed, RoomEvent.TrackStreamStateChanged, RoomEvent.TrackSubscriptionFailed];

export function useCallParticipants() {
	const call = useSelector((s: RootState) => s.call);
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const rooms = useSelector((s: RootState) => s.room.rooms);
	const usersById = useSelector((s: RootState) => s.users.byId);

	const participants = useParticipants({ updateOnlyOn: [RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantNameChanged] });
	const connectionState = useConnectionState();
	const previousCards = useRef<ParticipantCard[]>([]);
	const previousSources = useRef<MediaSourcePresentation[]>([]);

	const videoTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], { onlySubscribed: false, updateOnlyOn: mediaUpdates });
	const microphoneAudioTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }], { updateOnlyOn: mediaUpdates });
	const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false, updateOnlyOn: mediaUpdates });
	const screenAudioTracks = useTracks([{ source: Track.Source.ScreenShareAudio, withPlaceholder: false }], { updateOnlyOn: mediaUpdates });

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
		() => screenTracks.filter((trackRef) => trackRef.publication),
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
		// Participant snapshots can be transiently incomplete during Room recovery.
		if (connectionState === ConnectionState.Reconnecting || connectionState === ConnectionState.SignalReconnecting) {
			return previousCards.current;
		}
		const cards: ParticipantCard[] = [];
		sortedParticipants.forEach((participant) => {
			const avatarUrl = participantAvatarResolver(participant.identity, participant.isLocal);
			const displayName = participant.name || participant.identity;

			const cameraTrack = videoTrackByParticipant.get(participant.identity);
			const dimensions = cameraTrack?.publication.dimensions;
			cards.push({
				id: participant.identity,
				participant,
				videoTrack: cameraTrack,
				aspectRatio: (dimensions ? mediaAspectRatio(dimensions.width, dimensions.height) : undefined)
					?? previousCards.current.find((card) => card.id === participant.identity)?.aspectRatio,
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
		return stableCardOrder(cards, previousCards.current.map((card) => card.id));
	}, [sortedParticipants, videoTrackByParticipant, screenTrackByParticipant, participantAvatarResolver, connectionState]);
	useEffect(() => { previousCards.current = participantCards; }, [participantCards]);

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

	const reconnecting = connectionState === ConnectionState.Reconnecting || connectionState === ConnectionState.SignalReconnecting;
	const presentation = createPresentation(participantCards,
		reconnecting ? previousSources.current.map(s => s.trackRef) : [...videoTracks.filter(isTrackReference), ...screenTracks.filter(isTrackReference)], reconnecting);
	useEffect(() => { previousSources.current = presentation.sources; });
	return {
		people: presentation.people,
		mediaSources: presentation.sources,
		participantCards,
		sortedParticipants,
		remoteMicrophoneParticipants,
		remoteScreenAudioParticipants,
		participantCardByIdentity,
		availableScreenTracks,
		subscribedVideoTracks,
	};
}
