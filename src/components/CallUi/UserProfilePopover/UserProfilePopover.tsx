import { UserProfileCard } from "../../UserProfileCard/UserProfileCard";
import styles from "./UserProfilePopover.module.css";

interface UserProfilePopoverProps {
	x: number;
	y: number;
	displayName: string;
	username?: string;
	avatarUrl?: string | null;
	avatarBg: string;
	aboutMe?: string | null;
}

export function UserProfilePopover({
	x,
	y,
	displayName,
	username,
	avatarUrl,
	avatarBg,
	aboutMe,
}: UserProfilePopoverProps) {
	return (
		<div
			className={styles["popover"]}
			style={{ top: Math.max(12, Math.min(y, window.innerHeight - 300)), left: Math.max(12, Math.min(x, window.innerWidth - 344)) }}
			onClick={(event) => event.stopPropagation()}
		>
			<UserProfileCard
				displayName={displayName}
				username={username}
				avatarUrl={avatarUrl}
				avatarBg={avatarBg}
				aboutMe={aboutMe}
			/>
		</div>
	);
}
