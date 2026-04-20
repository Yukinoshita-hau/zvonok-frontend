import styles from "./UserProfileCard.module.css";
import type { UserProfileCardProps } from "./UserProfileCard.props";

export function UserProfileCard({
	displayName,
	username,
	avatarUrl,
	avatarBg,
	aboutMe,
}: UserProfileCardProps) {

	return (
		<div className={styles["container"]}>
			<div className={styles["header-section"]} style={{ background: `linear-gradient(180.00deg, ${avatarBg} 0%, var(--bg-primary))` }}>
				<div className={styles["avatar"]} style={!avatarUrl ? { backgroundColor: avatarBg } : undefined}>
					{avatarUrl ? (
						<img src={avatarUrl} crossOrigin="anonymous" />
					) : (
						<div>{(displayName?.[0] || "?").toUpperCase()}</div>
					)}
				</div>
				<div className={styles["name"]}>
					{displayName}{username && (<span className={styles["username"]}>#{username}</span>)}
				</div>
			</div>
			<div className={styles["info-section"]}>
				<div className={styles["about-me"]}>
					<div className={styles["about-me-label"]}>
						ABOUT ME
					</div>
					<div className={styles["about-me-content"]}>
						{aboutMe ?? "пока ничего"}
					</div>
				</div>
			</div>
		</div>
	);
}
