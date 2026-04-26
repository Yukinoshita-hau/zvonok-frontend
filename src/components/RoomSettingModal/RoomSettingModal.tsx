import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { RoomSettingButton } from "../RoomSettingButton/RoomSettingButton";
import styles from "./RoomSettingModal.module.css";
import type { RoomSettingModalProps } from "./RoomSettingModal.props";
import { RoomMembersList } from "../RoomMembersList/RoomMembersList";
import { useNavigate } from "react-router-dom";

export function RoomSettingModal({ isOpen, onClose, onStartCall, room }: RoomSettingModalProps) {
	const navigate = useNavigate();

	const myUser = useSelector((s: RootState) => s.user.myUser);
	const usersById = useSelector((s: RootState) => s.users.byId);

	const isVisible = useModalAnimation(isOpen);

	if (!isVisible || !room) return null;

	const members = room.memberIds
		.map((memberId) => usersById[memberId])
		.filter(Boolean);

	const normalizedName = room.name?.trim();

	const opponent = room.type === "PRIVATE"
		? members.find((member) => member.id !== myUser?.id) ?? null
		: null;

	const roomTitle = normalizedName || opponent?.username || "Unknown room";

	const membersCount = members.length;
	const avatarLabel = room.type === "GROUP" ? "GR" : "DM";

	return (
		<div className={styles["backdrop"]} data-state={isOpen ? "open" : "close"} onClick={onClose}>
			<div
				className={styles["modal"]}
				data-state={isOpen ? "open" : "close"}
				onClick={(e) => e.stopPropagation()}
			>
				<div className={styles["header"]}>
					<div className={styles["avatar"]}>{avatarLabel}</div>

					<div className={styles["room-name"]}>{roomTitle}</div>

					{room.type === "GROUP" && (
						<div className={styles["room-meta"]}>
							<span>Группа</span>
							<span>•</span>
							<span>
								{membersCount} {membersCount <= 4 ? "Участника" : "Участников"}
							</span>
						</div>
					)}

					<div className={styles["btn-action-section"]}>
						<RoomSettingButton
							onClick={() => {
								onClose();
								navigate(`/dm?roomId=${room.id}`);
							}}
						>
							Чат
						</RoomSettingButton>

						<RoomSettingButton onClick={onStartCall}>
							Звонок
						</RoomSettingButton>
					</div>
				</div>

				<div className={styles["room-info"]}>
					<div className={styles["section-title"]}>Участники</div>

					<RoomMembersList
						members={members}
						myUserId={myUser?.id}
					/>
				</div>
			</div>
		</div>
	);
}
