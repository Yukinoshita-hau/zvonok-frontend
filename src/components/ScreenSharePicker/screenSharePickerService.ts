import {
	SCREEN_SHARE_QUALITY_PRESETS,
	type ScreenShareManualQuality,
	type ScreenSharePresetGroup,
	type ScreenShareQualityPreset,
} from "../../utils/callQuality";
import type { ScreenShareSource } from "./ScreenSharePicker.types";

export interface ScreenShareQualityGroup {
	group: ScreenSharePresetGroup;
	label: string;
	description: string;
	presets: ScreenShareQualityPreset[];
}

const GROUP_ORDER: ScreenSharePresetGroup[] = ["base", "gaming", "crystal", "godlike"];
const DEFAULT_QUALITY: ScreenShareManualQuality = "high";

const WEB_SOURCES: ScreenShareSource[] = [
	{
		id: "web-screen-window",
		name: "Выбрать экран или окно",
		type: "screen",
	},
	{
		id: "web-tab",
		name: "Выбрать вкладку браузера",
		type: "tab",
	},
];

export const SCREEN_SHARE_PICKER_QUALITY_GROUPS: ScreenShareQualityGroup[] = GROUP_ORDER.map((group) => ({
	group,
	label: getGroupLabel(group),
	description: getGroupDescription(group),
	presets: Object.values(SCREEN_SHARE_QUALITY_PRESETS).filter((preset) => preset.group === group),
}));

export function isZvonokDesktop() {
	return Boolean(window.zvonokDesktop?.getScreenShareSources);
}

export function canUseSystemAudio() {
	return isZvonokDesktop() || typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

export async function getScreenShareSources(): Promise<ScreenShareSource[]> {
	if (isZvonokDesktop() && window.zvonokDesktop) {
		return window.zvonokDesktop.getScreenShareSources();
	}

	return WEB_SOURCES;
}

export async function setDesktopScreenShareSource(sourceId: string, includeSystemAudio: boolean) {
	if (!isZvonokDesktop() || !window.zvonokDesktop) return;
	await window.zvonokDesktop.setSelectedScreenShareSource(sourceId, includeSystemAudio);
}

export async function clearDesktopScreenShareSource() {
	if (!isZvonokDesktop() || !window.zvonokDesktop) return;
	await window.zvonokDesktop.clearSelectedScreenShareSource();
}

export function getScreenShareQualityPreset(value: ScreenShareManualQuality) {
	return SCREEN_SHARE_QUALITY_PRESETS[value] ?? SCREEN_SHARE_QUALITY_PRESETS[DEFAULT_QUALITY];
}

export function getDefaultScreenShareQuality() {
	return DEFAULT_QUALITY;
}

function getGroupLabel(group: ScreenSharePresetGroup) {
	switch (group) {
		case "base":
			return "Базовые";
		case "gaming":
			return "Игры";
		case "crystal":
			return "Чёткость";
		case "godlike":
			return "Экстрим";
	}
}

function getGroupDescription(group: ScreenSharePresetGroup) {
	switch (group) {
		case "base":
			return "Стабильные пресеты на каждый день.";
		case "gaming":
			return "Приоритет плавности и движения.";
		case "crystal":
			return "Больше детализации и читаемости.";
		case "godlike":
			return "Только для тестов и очень мощного интернета.";
	}
}
