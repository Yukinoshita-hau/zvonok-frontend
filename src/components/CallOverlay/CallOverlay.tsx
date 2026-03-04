import { useDispatch, useSelector } from "react-redux";
import styles from "./CallOverlay.module.css";
import cn from "classnames";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions, getToken } from "../../store/slices/call.clice";

export function CallOverlay() {
	const call = useSelector((s: RootState) => s.call);
	const dispatch = useDispatch<AppDispatch>();
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
						<img src="../../../public/call_icon.svg" />
					</button>

					<button className={cn(styles["btn"], styles["decline-button"])} onClick={handleDecline}>
						<img src="../../../public/call_icon.svg" />
					</button>
				</div>
			</div>
		</div>
	);
}
