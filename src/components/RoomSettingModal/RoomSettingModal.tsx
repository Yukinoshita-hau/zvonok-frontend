import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { RoomSettingButton } from "../RoomSettingButton/RoomSettingButton";
import styles from "./RoomSettingModal.module.css";
import type { RoomSettingModalProps } from "./RoomSettingModal.props";
import { useNavigate } from "react-router-dom";
import { RoomMembersPanel } from "../RoomMembersPanel/RoomMembersPanel";
import { RoomMemberProfilePopover } from "../RoomMemberProfilePopover/RoomMemberProfilePopover";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import type { UserMini } from "../../entities/UserMini";

export function RoomSettingModal({ isOpen, onClose, onStartCall, room }: RoomSettingModalProps) {
	const navigate = useNavigate();

	const myUser = useSelector((s: RootState) => s.user.myUser);
	const usersById = useSelector((s: RootState) => s.users.byId);
	const [selectedMember, setSelectedMember] = useState<UserMini | null>(null);
	const [selectedMemberAnchorRect, setSelectedMemberAnchorRect] = useState<DOMRect | null>(null);

	const isVisible = useModalAnimation(isOpen);

	const closeMemberPopover = useCallback(() => {
		setSelectedMember(null);
		setSelectedMemberAnchorRect(null);
	}, []);

	useDismissibleLayer({
		isOpen: isOpen,
		onDismiss: () => {
			if (selectedMember) {
				closeMemberPopover();
				return;
			}

			onClose();
		},
	});

	if (!isVisible || !room) return null;

	const members = room.memberIds
		.map((memberId) => usersById[memberId])
		.filter(Boolean);

	const normalizedName = room.name?.trim();

	const opponent = room.type === "PRIVATE"
		? members.find((member) => member.id !== myUser?.id) ?? null
		: null;

	const roomTitle = normalizedName || opponent?.displayName || opponent?.username || "Unknown room";

	const membersCount = members.length;
	const avatarLabel = room.type === "GROUP" ? "GR" : "DM";

	return (
		<div
			className={styles["backdrop"]}
			data-state={isOpen ? "open" : "close"}
			onClick={() => {
				if (selectedMember) {
					closeMemberPopover();
					return;
				}

				onClose();
			}}
		>
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

					<RoomMembersPanel
						members={members}
						myUserId={myUser?.id}
						onMemberSelect={(member, anchorRect) => {
							setSelectedMember(member);
							setSelectedMemberAnchorRect(anchorRect);
						}}
					/>
				</div>
			</div>

			{selectedMember && selectedMemberAnchorRect && (
				<RoomMemberProfilePopover
					member={selectedMember}
					anchorRect={selectedMemberAnchorRect}
				/>
			)}
		</div>
	);
}
