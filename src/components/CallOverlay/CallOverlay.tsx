import { useDispatch, useSelector } from "react-redux";
import styles from "./CallOverlay.module.css";
import cn from "classnames";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions, getToken } from "../../store/slices/call.slice";
import { useEffect } from "react";
import { soundPlayer } from "../../utils/soundPlayer";
import { Phone } from "lucide-react";

export function CallOverlay() {
	const call = useSelector((s: RootState) => s.call);
	const dispatch = useDispatch<AppDispatch>();

	useEffect(() => {
		if (call.status === "incoming_ringing") {
			soundPlayer.startCallRingtone();
		} else {
			soundPlayer.stopCallRingtone();
		}

		return () => {
			soundPlayer.stopCallRingtone();
		};
	}, [call.status])

	if (call.status !== "incoming_ringing") return null;

	const handleAccept = async () => {
		if (!call.chatRoomId || !call.callerUsername || !call.livekitRoomName) return null;

		dispatch({
			type: "call/sendAccept",
			payload: {
				chatRoomId: call.chatRoomId,
				callerUsername: call.callerUsername
			}
		})

		dispatch(getToken(call.livekitRoomName));
	}

	const handleDecline = () => {
		dispatch(callActions.endCall());
	}

	return (
		<div
			className={styles["backdrop"]}
			onClick={() => console.log("")}>
			<div
				className={styles["modal"]}
				onClick={(e) => e.stopPropagation()}>
				<div className={styles["header"]}>Входящий звонок от {call.callerUsername}</div>

				<div className={styles["body"]}>
					<button className={cn(styles["btn"], styles["accept-button"])} onClick={handleAccept}>
					<Phone color="white" size={20}/>
					</button>

					<button className={cn(styles["btn"], styles["decline-button"])} onClick={handleDecline}>
					<Phone color="white" size={20}/>
					</button>
				</div>
			</div>
		</div>
	);
}
