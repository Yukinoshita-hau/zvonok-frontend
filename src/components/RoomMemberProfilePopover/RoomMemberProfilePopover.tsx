import { useMemo } from "react";
import { UserProfileCard } from "../UserProfileCard/UserProfileCard";
import { StringToColor } from "../../utils/stringHelpers";
import type { RoomMemberProfilePopoverProps } from "./RoomMemberProfilePopover.props";
import styles from "./RoomMemberProfilePopover.module.css";

const CARD_WIDTH = 320;
const CARD_HEIGHT = 260;
const VIEWPORT_GAP = 12;

export function RoomMemberProfilePopover({ member, anchorRect }: RoomMemberProfilePopoverProps) {
	const avatarBg = StringToColor(member.username || member.displayName || String(member.id));
	const displayName = member.displayName || member.username;

	const position = useMemo(() => {
		const preferredLeft = anchorRect.right + 10;
		const fallbackLeft = anchorRect.left - CARD_WIDTH - 10;
		const canUsePreferred = preferredLeft + CARD_WIDTH + VIEWPORT_GAP <= window.innerWidth;
		const rawLeft = canUsePreferred ? preferredLeft : fallbackLeft;
		const left = clamp(rawLeft, VIEWPORT_GAP, window.innerWidth - CARD_WIDTH - VIEWPORT_GAP);
		const rawTop = anchorRect.top;
		const top = clamp(rawTop, VIEWPORT_GAP, window.innerHeight - CARD_HEIGHT - VIEWPORT_GAP);

		return { top, left };
	}, [anchorRect]);

	return (
		<div className={styles["popover"]} style={position} onClick={(event) => event.stopPropagation()}>
			<UserProfileCard
				displayName={displayName}
				username={member.username}
				avatarUrl={member.avatarUrl}
				avatarBg={avatarBg}
				aboutMe={null}
			/>
		</div>
	);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}
