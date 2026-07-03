import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useSelector } from "react-redux";
import { useMicrophoneCaptureOptions } from "../CallUi/useMicrophoneCaptureOptions";
import type { RootState } from "../../store/store";
import {
	getCameraCaptureOptions,
	getCameraPublishOptions,
	getQualityPreset,
	resolveQualitySetting,
} from "../../utils/callQuality";
import {
	isKeyboardShortcutEvent,
	toElectronAccelerator,
} from "../../utils/keyboardShortcut";
import type { DesktopHotkeyAction } from "../ScreenSharePicker/ScreenSharePicker.types";

const OPEN_SCREEN_SHARE_PICKER_EVENT = "zvonok:open-screen-share-picker";

export function CallHotkeys() {
	const room = useRoomContext();
	const microphoneCaptureOptions = useMicrophoneCaptureOptions();
	const registeredDesktopHotkeysRef = useRef<Set<DesktopHotkeyAction>>(new Set());

	const {
		muteMicrophoneHotkey,
		toggleCameraHotkey,
		toggleScreenShareHotkey,
		selectedCameraId,
		cameraQuality,
		connectionTestResult,
	} = useSelector((s: RootState) => s.device);

	const cameraPreset = useMemo(() => {
		const quality = resolveQualitySetting(
			"camera",
			cameraQuality,
			connectionTestResult.recommendation
		);
		return getQualityPreset("camera", quality);
	}, [cameraQuality, connectionTestResult.recommendation]);

	const toggleMicrophone = useCallback(() => {
		const nextEnabled = !room.localParticipant.isMicrophoneEnabled;
		void room.localParticipant.setMicrophoneEnabled(nextEnabled, microphoneCaptureOptions).catch((error) => {
			console.error("Failed to toggle microphone from hotkey", error);
		});
	}, [microphoneCaptureOptions, room]);

	const toggleCamera = useCallback(() => {
		const nextEnabled = !room.localParticipant.isCameraEnabled;
		void room.localParticipant.setCameraEnabled(
			nextEnabled,
			getCameraCaptureOptions(selectedCameraId, cameraPreset),
			getCameraPublishOptions(cameraPreset)
		).catch((error) => {
			console.error("Failed to toggle camera from hotkey", error);
		});
	}, [cameraPreset, room, selectedCameraId]);

	const toggleScreenShare = useCallback(() => {
		if (room.localParticipant.isScreenShareEnabled) {
			void room.localParticipant.setScreenShareEnabled(false).catch((error) => {
				console.error("Failed to stop screen share from hotkey", error);
			});
			return;
		}

		window.dispatchEvent(new CustomEvent(OPEN_SCREEN_SHARE_PICKER_EVENT));
	}, [room]);

	const runHotkeyAction = useCallback((action: DesktopHotkeyAction) => {
		if (action === "microphone") {
			toggleMicrophone();
			return;
		}

		if (action === "camera") {
			toggleCamera();
			return;
		}

		toggleScreenShare();
	}, [toggleCamera, toggleMicrophone, toggleScreenShare]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.repeat || event.defaultPrevented) return;
			if (isEditableTarget(event.target) || isModalOpen()) return;

			const action = getKeyboardAction(event, {
				microphone: muteMicrophoneHotkey,
				camera: toggleCameraHotkey,
				screenShare: toggleScreenShareHotkey,
			});

			if (!action || registeredDesktopHotkeysRef.current.has(action)) return;

			event.preventDefault();
			runHotkeyAction(action);
		};

		window.addEventListener("keydown", onKeyDown);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [
		muteMicrophoneHotkey,
		runHotkeyAction,
		toggleCameraHotkey,
		toggleScreenShareHotkey,
	]);

	useEffect(() => {
		const desktopHotkeys = window.zvonokDesktop?.hotkeys;
		if (!desktopHotkeys) return;

		let isDisposed = false;
		const nextRegisteredActions = new Set<DesktopHotkeyAction>();
		const removePressedListener = desktopHotkeys.onHotkeyPressed((action) => {
			runHotkeyAction(action);
		});

		const registrations: Array<[DesktopHotkeyAction, string]> = [
			["microphone", toElectronAccelerator(muteMicrophoneHotkey)],
			["camera", toElectronAccelerator(toggleCameraHotkey)],
			["screenShare", toElectronAccelerator(toggleScreenShareHotkey)],
		];

		registrations.forEach(([action, accelerator]) => {
			void desktopHotkeys.registerHotkey(action, accelerator).then((isRegistered) => {
				if (isDisposed || !isRegistered) return;
				nextRegisteredActions.add(action);
				registeredDesktopHotkeysRef.current = new Set(nextRegisteredActions);
			}).catch((error) => {
				console.error(`Failed to register desktop ${action} hotkey`, error);
			});
		});

		return () => {
			isDisposed = true;
			registeredDesktopHotkeysRef.current = new Set();
			removePressedListener();
			registrations.forEach(([action]) => {
				void desktopHotkeys.unregisterHotkey(action);
			});
		};
	}, [
		muteMicrophoneHotkey,
		runHotkeyAction,
		toggleCameraHotkey,
		toggleScreenShareHotkey,
	]);

	return null;
}

function getKeyboardAction(
	event: KeyboardEvent,
	hotkeys: Record<DesktopHotkeyAction, RootState["device"]["muteMicrophoneHotkey"]>
): DesktopHotkeyAction | null {
	if (isKeyboardShortcutEvent(event, hotkeys.microphone)) return "microphone";
	if (isKeyboardShortcutEvent(event, hotkeys.camera)) return "camera";
	if (isKeyboardShortcutEvent(event, hotkeys.screenShare)) return "screenShare";
	return null;
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
