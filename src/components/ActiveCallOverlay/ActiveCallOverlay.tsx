import {  useSelector } from "react-redux";
import styles from "./ActiveCallOverlay.module.css";
import type {  RootState } from "../../store/store";
import type { ActiveCallOverlayProps } from "./ActiveCallOverlay.props";
import { LiveKitRoom } from "@livekit/components-react";
import { CallUi } from "../CallUi/CallUi";
import { useState } from "react";

export function ActiveCallOverlay({ currentRoomId }: ActiveCallOverlayProps) {
	const [callHeight, setCallHeight] = useState(55); // это в vh типа 50vh

	const call = useSelector((s: RootState) => s.call);

	if ((call.chatRoomId !== currentRoomId) || (call.status !== "connecting" &&
		call.status !== "in_call")) return null;

	if (!call.serverUrl || !call.participantToken) return null;


	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		const startY = e.clientY;
		const startHeight = callHeight;

		const onMove = (moveEvent: MouseEvent) => {
			const delta = moveEvent.clientY - startY;
			const vhDelta = (delta / window.innerHeight) * 100;
			const next = Math.min(65, Math.max(55, startHeight + vhDelta));
			console.log("onMove")
			setCallHeight(next);
		};

		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		}

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	return (
		<div className={styles["call-bar"]}>
			<div className={styles["room-wrapper"]}>
				<div className={styles["room-container"]} style={{ height: `${callHeight}vh` }}>
					<LiveKitRoom
						serverUrl={call.serverUrl}
						token={call.participantToken}
						connect={true}
					>
						<CallUi />

					</LiveKitRoom>
				</div>

				<div className={styles["resize-handle"]} onMouseDown={handleMouseDown} />
			</div>
		</div>
	)
}
