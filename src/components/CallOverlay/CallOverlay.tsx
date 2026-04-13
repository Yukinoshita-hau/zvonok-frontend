import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import cn from "classnames";
import { Phone } from "lucide-react";
import styles from "./CallOverlay.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions, getToken } from "../../store/slices/call.slice";
import { soundPlayer } from "../../utils/soundPlayer";

export function CallOverlay() {
	const call = useSelector((s: RootState) => s.call);
	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();

	useEffect(() => {
		if (call.status === "incoming_ringing") {
			soundPlayer.startCallRingtone();
		} else {
			soundPlayer.stopCallRingtone();
		}

		return () => {
			soundPlayer.stopCallRingtone();
		};
	}, [call.status]);

	const isIncoming = call.status === "incoming_ringing";
	const isOutgoing = call.status === "outgoing_ringing";

	if (!isIncoming && !isOutgoing) return null;

	const handleAccept = () => {
		if (!call.chatRoomId || !call.callerUsername || !call.livekitRoomName) return;

		dispatch({
			type: "call/sendAccept",
			payload: {
				chatRoomId: call.chatRoomId,
				callerUsername: call.callerUsername,
			},
		});

		navigate(`/dm?roomId=${call.chatRoomId}`);
		dispatch(getToken(call.livekitRoomName));
	};

	const handleDecline = () => {
		dispatch(callActions.endCall());
	};

	if (isOutgoing) {
		return (
			<div className={styles["outgoing-card"]}>
				<div className={styles["outgoing-copy"]}>
					<div className={styles["outgoing-title"]}>Calling...</div>
					<div className={styles["outgoing-subtitle"]}>
						Waiting for the other participant to answer.
					</div>
				</div>
				<button
					className={cn(styles["btn"], styles["decline-button"])}
					onClick={handleDecline}
				>
					<Phone color="white" size={20} />
				</button>
			</div>
		);
	}

	return (
		<div className={styles["backdrop"]}>
			<div className={styles["modal"]} onClick={(e) => e.stopPropagation()}>
				<div className={styles["header"]}>
					Incoming call from {call.callerUsername}
				</div>

				<div className={styles["body"]}>
					<button
						className={cn(styles["btn"], styles["accept-button"])}
						onClick={handleAccept}
					>
						<Phone color="white" size={20} />
					</button>

					<button
						className={cn(styles["btn"], styles["decline-button"])}
						onClick={handleDecline}
					>
						<Phone color="white" size={20} />
					</button>
				</div>
			</div>
		</div>
	);
}
