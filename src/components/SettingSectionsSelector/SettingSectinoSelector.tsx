import type React from "react";
import { AccountSetting } from "../AccountSetting/AccountSetting";
import type { SettingSectionsSelectorProps } from "./SettingSectionsSelector.props";
import { SECTIONS } from "../SettingModal/SettingSections";
import { VoiceVideoSetting } from "../VoiceVideoSetting/VoiceVideoSetting";

const NAVIGATE_SECTION_MAP: Record<string, React.ReactNode> = {
	[SECTIONS.ACCOUNT]: <AccountSetting />,
	[SECTIONS.VOICE]: <VoiceVideoSetting />
}

export function SettingSectionsSelector({ sectionName }: SettingSectionsSelectorProps) {

	return <>{NAVIGATE_SECTION_MAP[sectionName] || <AccountSetting />}</>;
}
