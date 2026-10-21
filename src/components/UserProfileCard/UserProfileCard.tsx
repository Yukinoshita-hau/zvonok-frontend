import styles from "./UserProfileCard.module.css";
import type { UserProfileCardProps } from "./UserProfileCard.props";
import { resolveMediaUrl } from "../../utils/mediaUrl";

export function UserProfileCard({
	displayName,
	username,
	avatarUrl,
	avatarBg,
	aboutMe,
}: UserProfileCardProps) {
	const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);

	return (
		<div className={styles["container"]}>
			<div className={styles["header-section"]}>
				<div className={styles["avatar"]} style={!resolvedAvatarUrl ? { backgroundColor: avatarBg } : undefined}>
					{resolvedAvatarUrl ? (
						<img src={resolvedAvatarUrl} alt={displayName || username || 'Аватар'} />
					) : (
						<div>{(displayName?.[0] || "?").toUpperCase()}</div>
					)}
				</div>
				<div className={styles["name"]}>
					{displayName || username}{username && (<span className={styles["username"]}>@{username}</span>)}
				</div>
			</div>
			{aboutMe && <div className={styles["info-section"]}>
				<div className={styles["about-me"]}>
					<div className={styles["about-me-label"]}>
						Обо мне
					</div>
					<div className={styles["about-me-content"]}>
						{aboutMe}
					</div>
				</div>
			</div>}
		</div>
	);
}
