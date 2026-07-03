export interface KeyboardShortcutPreference {
	code: string;
	key: string;
	ctrlKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	metaKey: boolean;
	label: string;
}

export function normalizeKeyboardShortcut(
	value: Partial<KeyboardShortcutPreference> | undefined,
	fallback: KeyboardShortcutPreference
): KeyboardShortcutPreference {
	if (!value?.code || typeof value.code !== "string") return fallback;
	return {
		code: value.code,
		key: typeof value.key === "string" ? value.key : "",
		ctrlKey: Boolean(value.ctrlKey),
		altKey: Boolean(value.altKey),
		shiftKey: Boolean(value.shiftKey),
		metaKey: Boolean(value.metaKey),
		label: typeof value.label === "string" && value.label.trim() ? value.label : fallback.label,
	};
}

export function createShortcutPreference(event: KeyboardEvent): KeyboardShortcutPreference | null {
	if (isModifierKey(event.key)) return null;

	const keyLabel = getShortcutKeyLabel(event);
	if (!keyLabel) return null;

	const parts = [
		event.ctrlKey ? "Ctrl" : null,
		event.altKey ? "Alt" : null,
		event.shiftKey ? "Shift" : null,
		event.metaKey ? "Meta" : null,
		keyLabel,
	].filter((part): part is string => Boolean(part));

	return {
		code: event.code,
		key: event.key,
		ctrlKey: event.ctrlKey,
		altKey: event.altKey,
		shiftKey: event.shiftKey,
		metaKey: event.metaKey,
		label: parts.join("+"),
	};
}

export function isKeyboardShortcutEvent(
	event: KeyboardEvent,
	hotkey: KeyboardShortcutPreference
) {
	return (
		event.code === hotkey.code &&
		event.ctrlKey === hotkey.ctrlKey &&
		event.altKey === hotkey.altKey &&
		event.shiftKey === hotkey.shiftKey &&
		event.metaKey === hotkey.metaKey
	);
}

export function toElectronAccelerator(hotkey: KeyboardShortcutPreference) {
	const parts = [
		hotkey.ctrlKey ? "Ctrl" : null,
		hotkey.altKey ? "Alt" : null,
		hotkey.shiftKey ? "Shift" : null,
		hotkey.metaKey ? "Super" : null,
		getElectronKey(hotkey),
	].filter((part): part is string => Boolean(part));

	return parts.join("+");
}

function isModifierKey(key: string) {
	return key === "Control" || key === "Alt" || key === "Shift" || key === "Meta";
}

function getShortcutKeyLabel(event: KeyboardEvent) {
	if (event.code.startsWith("Key")) return event.code.slice(3);
	if (event.code.startsWith("Digit")) return event.code.slice(5);
	if (event.code.startsWith("Numpad")) return event.code.replace("Numpad", "Num ");
	if (event.code === "Space") return "Space";
	if (event.code === "Minus") return "-";
	if (event.code === "Equal") return "=";
	if (event.code.startsWith("Arrow")) return event.code.replace("Arrow", "");
	if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.code)) return event.code;
	if (event.key.length === 1) return event.key.toUpperCase();
	return event.key;
}

function getElectronKey(hotkey: KeyboardShortcutPreference) {
	if (hotkey.code.startsWith("Key")) return hotkey.code.slice(3);
	if (hotkey.code.startsWith("Digit")) return hotkey.code.slice(5);
	if (hotkey.code.startsWith("Numpad")) return `num${hotkey.code.slice("Numpad".length)}`;
	if (hotkey.code.startsWith("Arrow")) return hotkey.code.slice("Arrow".length);
	if (/^F([1-9]|1[0-9]|2[0-4])$/.test(hotkey.code)) return hotkey.code;

	const keyMap: Record<string, string> = {
		Space: "Space",
		Enter: "Enter",
		Escape: "Esc",
		Tab: "Tab",
		Backspace: "Backspace",
		Delete: "Delete",
		Insert: "Insert",
		Home: "Home",
		End: "End",
		PageUp: "PageUp",
		PageDown: "PageDown",
		Minus: "-",
		Equal: "=",
		BracketLeft: "[",
		BracketRight: "]",
		Backslash: "\\",
		Semicolon: ";",
		Quote: "'",
		Comma: ",",
		Period: ".",
		Slash: "/",
		Backquote: "`",
	};

	return keyMap[hotkey.code] ?? hotkey.key.toUpperCase();
}
