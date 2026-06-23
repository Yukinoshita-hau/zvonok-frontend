import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useSelector } from "react-redux";
import { useMicrophoneCaptureOptions } from "../CallUi/useMicrophoneCaptureOptions";
import type { RootState } from "../../store/store";


export function CallHotkeys() {
	const room = useRoomContext();
	const captureOptions = useMicrophoneCaptureOptions();
	const muteMicrophoneHotkey = useSelector(
		(s: RootState) => s.device.muteMicrophoneHotkey
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.repeat || event.defaultPrevented) return;
			if (!isMuteHotkey(event, muteMicrophoneHotkey)) return;
			if (isEditableTarget(event.target) || isModalOpen()) return;

			event.preventDefault();
			const nextEnabled = !room.localParticipant.isMicrophoneEnabled;
			void room.localParticipant.setMicrophoneEnabled(nextEnabled, captureOptions).catch((error) => {
				console.error("Failed to toggle microphone from hotkey", error);
			});
		};

		window.addEventListener("keydown", onKeyDown);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [captureOptions, muteMicrophoneHotkey, room]);

	return null;
}

function isMuteHotkey(
	event: KeyboardEvent,
	hotkey: RootState["device"]["muteMicrophoneHotkey"]
) {
	return (
		event.code === hotkey.code &&
		event.ctrlKey === hotkey.ctrlKey &&
		event.altKey === hotkey.altKey &&
		event.shiftKey === hotkey.shiftKey &&
		event.metaKey === hotkey.metaKey
	);
}

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;

	if (target.isContentEditable) return true;

	return Boolean(
		target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")
	);
}

function isModalOpen() {
	return Boolean(
		document.querySelector("[aria-modal='true'], [role='dialog'], [data-state='open']")
	);
}
