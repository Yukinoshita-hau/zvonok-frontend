import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./UserMiniCard.module.css";
import type { UserMiniCardProps } from "./UserMiniCard.props";

const GAP = 8;

export function UserMiniCard({
	isOpen,
	displayName,
	username,
	avatarBg,
	avatarUrl,
	statusLabel,
	aboutMe,
	relationship,
	anchorRect,
	onClose,
	onMessage,
	onAddFriend,
	onRemoveFriend,
}: UserMiniCardProps) {
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};

		const handleOutsideClick = (event: MouseEvent) => {
			if (!rootRef.current) return;
			if (!rootRef.current.contains(event.target as Node)) {
				onClose();
			}
		};

		document.addEventListener("keydown", handleEscape);
		document.addEventListener("mousedown", handleOutsideClick);

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, [isOpen, onClose]);

	useEffect(() => {
		if (!isOpen || !rootRef.current) return;
		rootRef.current.focus({ preventScroll: true });
	}, [isOpen]);

	const position = useMemo(() => {
		if (!anchorRect) return null;

		const estimatedWidth = Math.min(320, window.innerWidth - 24);
		const estimatedHeight = 260;
		const placeRight = anchorRect.right + estimatedWidth + GAP <= window.innerWidth;
		const left = placeRight
			? anchorRect.right + GAP
			: Math.max(12, anchorRect.left - estimatedWidth - GAP);
		const maxTop = window.innerHeight - estimatedHeight - 12;
		const top = Math.min(Math.max(12, anchorRect.top), maxTop);

		return { top, left };
	}, [anchorRect]);

	if (!isOpen || !position) return null;

	const relationshipLabel =
		relationship === "friend"
			? "Friend"
			: relationship === "outgoing"
				? "Request sent"
				: relationship === "incoming"
					? "Incoming request"
					: relationship === "self"
						? "You"
						: "Not friends";

	const card = (
		<div
			ref={rootRef}
			className={styles["popout"]}
			style={position}
			role="dialog"
			aria-label={`Profile of ${displayName}`}
			tabIndex={-1}
		>
			<div className={styles["header"]} style={{ borderTop: `3px solid ${avatarBg}` }}>
				<div className={styles["avatar"]} style={!avatarUrl ? { backgroundColor: avatarBg } : undefined}>
					{avatarUrl ? <img src={avatarUrl} crossOrigin="anonymous" alt={displayName} /> : <div>{(displayName[0] || "?").toUpperCase()}</div>}
				</div>
				<div className={styles["title"]}>
					<div className={styles["display-name"]}>{displayName}</div>
					<div className={styles["username"]}>@{username}</div>
				</div>
			</div>

			<div className={styles["body"]}>
				<div className={styles["meta"]}>{statusLabel ? `${statusLabel} • ${relationshipLabel}` : relationshipLabel}</div>
				<div className={styles["about"]}>{aboutMe?.trim() ? aboutMe : "No bio yet"}</div>
				<div className={styles["actions"]}>
					{onMessage && (
						<button className={styles["secondary"]} onClick={onMessage}>
							Message
						</button>
					)}

					{relationship === "none" && onAddFriend && (
						<button className={styles["primary"]} onClick={onAddFriend}>
							Add friend
						</button>
					)}

					{relationship === "friend" && onRemoveFriend && (
						<button className={styles["secondary"]} onClick={onRemoveFriend}>
							Remove friend
						</button>
					)}

					{(relationship === "outgoing" || relationship === "incoming" || relationship === "self") && (
						<button className={styles["neutral"]} type="button" aria-disabled>
							{relationshipLabel}
						</button>
					)}
				</div>
			</div>
		</div>
	);

	return createPortal(card, document.body);
}
