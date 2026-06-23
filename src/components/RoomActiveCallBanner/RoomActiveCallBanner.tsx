import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { activeCallActions } from "../../store/slices/activeCall.slice";
import { getCallToken } from "../../store/slices/call.slice";
import styles from "./RoomActiveCallBanner.module.css";

interface RoomActiveCallBannerProps {
	roomId: number | null;
}

export function RoomActiveCallBanner({ roomId }: RoomActiveCallBannerProps) {
	const dispatch = useDispatch<AppDispatch>();
	const activeCall = useSelector((s: RootState) => roomId ? s.activeCall.activeCallsByRoomId[roomId] : null);
	const joinStatus = useSelector((s: RootState) => s.activeCall.joinStatus);
	const joinError = useSelector((s: RootState) => s.activeCall.joinError);
	const currentCallId = useSelector((s: RootState) => s.call.callId ?? s.activeCall.currentCallId);
	const currentUser = useSelector((s: RootState) => s.user.myUser);

	if (!activeCall) return null;

	const currentParticipant = activeCall.participants.find((participant) => participant.username === currentUser?.username);
	const isCurrentUserInThisCall = currentCallId === activeCall.callId
		&& (currentParticipant?.status === "ACCEPTED" || currentParticipant?.status === "JOINED");
	const isActiveStatus = activeCall.status === "ACTIVE" || activeCall.status === "RINGING";
	const shouldShowBanner = isActiveStatus && !isCurrentUserInThisCall
		&& (activeCall.roomType === "GROUP" || activeCall.roomType === "PRIVATE");

	if (!shouldShowBanner) return null;

	const handleJoin = async () => {
		try {
			dispatch(activeCallActions.setCurrentCall({ callId: activeCall.callId, roomId: activeCall.chatRoomId }));

			dispatch({
				type: "call/sendJoin",
				payload: {
					callId: activeCall.callId,
					chatRoomId: activeCall.chatRoomId ?? undefined,
				},
			});
			dispatch(getCallToken(activeCall.callId));
		} catch {
			// joinError is stored in Redux and rendered in the banner.
		}
	};

	return (
		<div className={styles["banner"]}>
			<div className={styles["content"]}>
				<span className={styles["title"]}>{activeCall.roomType === "GROUP" ? "В комнате идёт звонок" : "Идёт звонок"}</span>
				{typeof activeCall.participantsCount === "number" && (
					<span className={styles["meta"]}>Участников: {activeCall.participantsCount}</span>
				)}
				{joinError && <span className={styles["error"]}>{joinError}</span>}
			</div>
			<button className={styles["join-button"]} disabled={joinStatus === "loading"} onClick={handleJoin}>
				{joinStatus === "loading" ? "Входим..." : "Войти"}
			</button>
		</div>
	);
}
