import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useMicrophoneCaptureOptions } from "../CallUi/useMicrophoneCaptureOptions";

const MUTE_HOTKEY_CODE = "KeyM";
const MUTE_HOTKEY_KEYS = new Set(["m", "ь", "м"]);

export function CallHotkeys() {
	const room = useRoomContext();
	const captureOptions = useMicrophoneCaptureOptions();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.repeat || event.defaultPrevented) return;
			if (!isMuteHotkey(event)) return;
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
	}, [captureOptions, room]);

	return null;
}

function isMuteHotkey(event: KeyboardEvent) {
	if (!event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey) return false;
	if (event.code === MUTE_HOTKEY_CODE) return true;

	return MUTE_HOTKEY_KEYS.has(event.key.toLowerCase());
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
