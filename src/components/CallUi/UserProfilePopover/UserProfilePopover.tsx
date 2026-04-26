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
			style={{ top: y, left: x }}
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
