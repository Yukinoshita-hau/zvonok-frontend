import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MicrophoneToggleButton } from "../CallUi/MicrophoneToggleButton";
import styles from "./ShellUserPanel.module.css";

// A portal keeps the button under the existing LiveKit and microphone owner contexts.
export function ShellMicrophoneControl() {
	const [target, setTarget] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setTarget(document.getElementById("shell-microphone"));
	}, []);
	return target
		? createPortal(
				<MicrophoneToggleButton
					className={styles.icon}
					enabledLabel=""
					disabledLabel=""
					showIcon
					iconSize={18}
				/>,
				target,
			)
		: null;
}
