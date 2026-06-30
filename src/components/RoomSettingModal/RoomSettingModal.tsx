import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { RoomSettingButton } from "../RoomSettingButton/RoomSettingButton";
import styles from "./RoomSettingModal.module.css";
import type { RoomSettingModalProps } from "./RoomSettingModal.props";
import { useNavigate } from "react-router-dom";
import { RoomMembersPanel } from "../RoomMembersPanel/RoomMembersPanel";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import type { UserMini } from "../../entities/UserMini";
import { AddGroupMembersModal } from "../AddGroupMembersModal/AddGroupMembersModal";
import { UserMiniProfileModal } from "../UserMiniProfileModal/UserMiniProfileModal";
import { addRoomMembers, fetchMyRooms, leaveRoom } from "../../store/slices/room.slice";
import { fetchMyFriends } from "../../store/slices/friend.slice";
import { clearRoomMessages } from "../../store/slices/message.slice";
import { toastActions } from "../../store/slices/toast.slice";
import { roomApi } from "../../api/roomApi";

export function RoomSettingModal({ isOpen, onClose, onStartCall, room }: RoomSettingModalProps) {
	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();

	const myUser = useSelector((s: RootState) => s.user.myUser);
	const usersById = useSelector((s: RootState) => s.users.byId);
	const friends = useSelector((s: RootState) => s.friend.friends);
	const [selectedMember, setSelectedMember] = useState<UserMini | null>(null);
	const [activeSection, setActiveSection] = useState<"main" | "members" | "invite" | "danger">("main");
	const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
	const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
	const [isSubmittingMembers, setIsSubmittingMembers] = useState(false);
	const [isLeavingRoom, setIsLeavingRoom] = useState(false);
	const [inviteUrl, setInviteUrl] = useState<string | null>(null);
	const [isInviteLoading, setIsInviteLoading] = useState(false);
	const [isInviteCopied, setIsInviteCopied] = useState(false);

	const isVisible = useModalAnimation(isOpen);
	const existingMemberIds = useMemo(
		() => new Set(room?.memberIds ?? []),
		[room?.memberIds]
	);

	const closeMemberPopover = useCallback(() => {
		setSelectedMember(null);
	}, []);

	useEffect(() => {
		if (!isOpen || room?.type !== "GROUP") return;

		dispatch(fetchMyFriends());
	}, [dispatch, isOpen, room?.type]);

	useDismissibleLayer({
		isOpen: isOpen,
		dismissOnScroll: false,
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
	const inviteLink = inviteUrl ?? "";
	const roomSections = room.type === "GROUP"
		? [
			{ id: "main", label: "Основное" },
			{ id: "members", label: "Участники" },
			{ id: "invite", label: "Invite-ссылка" },
			{ id: "danger", label: "Опасная зона" },
		] as const
		: [
			{ id: "main", label: "Основное" },
			{ id: "members", label: "Участники" },
		] as const;

	const handleClearMessages = async () => {
		if (!room) return;

		const result = await dispatch(clearRoomMessages({ roomId: room.id }));

		if (clearRoomMessages.fulfilled.match(result)) {
			dispatch(fetchMyRooms());
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "success",
				title: "Сообщения очищены",
				message: "История комнаты была очищена.",
			}));
			setIsClearConfirmOpen(false);
			return;
		}

		dispatch(toastActions.showToast({
			id: crypto.randomUUID(),
			type: "error",
			title: "Не удалось очистить",
			message: typeof result.payload === "string" ? result.payload : "Попробуйте позже.",
		}));
	};

	const handleAddMembers = async (userIds: number[]) => {
		setIsSubmittingMembers(true);
		const result = await dispatch(addRoomMembers({ roomId: room.id, userIds }));
		setIsSubmittingMembers(false);

		if (addRoomMembers.fulfilled.match(result)) {
			const skippedCount = result.payload.skippedUserIds?.length ?? 0;
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: skippedCount > 0 ? "info" : "success",
				title: "Участники добавлены",
				message: skippedCount > 0
					? `Добавлено, но пропущено: ${skippedCount}.`
					: "Друзья добавлены в группу.",
			}));
			setIsAddMembersOpen(false);
			return;
		}

		dispatch(toastActions.showToast({
			id: crypto.randomUUID(),
			type: "error",
			title: "Не удалось добавить",
			message: typeof result.payload === "string" ? result.payload : "Попробуйте позже.",
		}));
	};

	const handleCreateInvite = async () => {
		setIsInviteLoading(true);
		try {
			const { data } = await roomApi.createInvite(room.id);
			const origin = window.location.origin;
			const token = data.token ?? data.inviteToken ?? data.inviteCode ?? data.code ?? null;

			const backendUrl = data.url ?? data.inviteUrl ?? null;
			const normalizeInviteUrl = (value: string) => {
				if (/^https?:\/\//i.test(value)) return value;
				if (value.startsWith("/")) return `${origin}${value}`;

				return `${origin}/invite/${value}`;
			};

			if (!backendUrl && !token) {
				throw new Error("Backend не вернул token для invite-ссылки.");
			}

			setInviteUrl(normalizeInviteUrl(backendUrl ?? token ?? ""));
			setIsInviteCopied(false);
		} catch (e: unknown) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "error",
				title: "Invite не создан",
				message: e instanceof Error ? e.message : "Попробуйте позже.",
			}));
		} finally {
			setIsInviteLoading(false);
		}
	};

	const handleCopyInvite = async () => {
		if (!inviteLink) return;

		await navigator.clipboard.writeText(inviteLink);
		setIsInviteCopied(true);
	};

	const handleLeaveRoom = async () => {
		if (room.type !== "GROUP" || isLeavingRoom) return;

		setIsLeavingRoom(true);
		const result = await dispatch(leaveRoom({ roomId: room.id }));
		setIsLeavingRoom(false);

		if (leaveRoom.fulfilled.match(result)) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "success",
				title: "Вы вышли из группы",
				message: roomTitle,
			}));
			onClose();
			return;
		}

		dispatch(toastActions.showToast({
			id: crypto.randomUUID(),
			type: "error",
			title: "Не удалось выйти",
			message: typeof result.payload === "string" ? result.payload : "Попробуйте позже.",
		}));
	};

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
					<div className={styles["section-tabs"]}>
						{roomSections.map((section) => (
							<button
								key={section.id}
								type="button"
								data-active={activeSection === section.id}
								onClick={() => setActiveSection(section.id)}
							>
								{section.label}
							</button>
						))}
					</div>

					{activeSection === "main" && (
						<div className={styles["section-card"]}>
							<div className={styles["section-title"]}>Основное</div>
							<div className={styles["info-grid"]}>
								<div>
									<span>Название</span>
									<strong>{roomTitle}</strong>
								</div>
								<div>
									<span>Тип</span>
									<strong>{room.type === "GROUP" ? "Группа" : "Личный чат"}</strong>
								</div>
								<div>
									<span>Участники</span>
									<strong>{membersCount}</strong>
								</div>
							</div>
						</div>
					)}

					{activeSection === "members" && (
						<div className={styles["section-card"]}>
							<div className={styles["section-row"]}>
								<div className={styles["section-title"]}>Участники</div>
								{room.type === "GROUP" && (
									<button
										type="button"
										className={styles["small-action"]}
										onClick={() => setIsAddMembersOpen(true)}
									>
										Добавить друзей
									</button>
								)}
							</div>

							<RoomMembersPanel
								members={members}
								myUserId={myUser?.id}
								onMemberSelect={(member) => {
									setSelectedMember(member);
								}}
							/>
						</div>
					)}

					{activeSection === "invite" && room.type === "GROUP" && (
						<div className={styles["section-card"]}>
							<div className={styles["section-title"]}>Invite-ссылка</div>
							<p className={styles["muted"]}>
								Создайте ссылку, по которой авторизованные пользователи смогут вступить в группу.
							</p>

							<div className={styles["invite-row"]}>
								<input
									readOnly
									value={inviteLink}
									placeholder="Ссылка ещё не создана"
								/>
								<button
									type="button"
									className={styles["small-action"]}
									disabled={!inviteLink}
									onClick={() => void handleCopyInvite()}
								>
									{isInviteCopied ? "Скопировано" : "Копировать"}
								</button>
							</div>

							<button
								type="button"
								className={styles["primary-action"]}
								disabled={isInviteLoading}
								onClick={() => void handleCreateInvite()}
							>
								{isInviteLoading ? "Создаём..." : "Создать invite-ссылку"}
							</button>
						</div>
					)}

					{activeSection === "danger" && room.type === "GROUP" && (
						<div className={`${styles["section-card"]} ${styles["danger-card"]}`}>
							<div className={styles["section-title"]}>Опасная зона</div>
							<p className={styles["muted"]}>
								Эти действия могут повлиять на всех участников комнаты.
							</p>
							<button
								type="button"
								className={styles["danger-action"]}
								onClick={() => setIsClearConfirmOpen(true)}
							>
								Очистить сообщения
							</button>
							<button
								type="button"
								className={styles["danger-action"]}
								disabled={isLeavingRoom}
								onClick={() => void handleLeaveRoom()}
							>
								{isLeavingRoom ? "Выходим..." : "Выйти из группы"}
							</button>
						</div>
					)}
				</div>
			</div>

			<UserMiniProfileModal
				userId={selectedMember?.id ?? null}
				isOpen={selectedMember !== null}
				fallbackUser={selectedMember ? {
					username: selectedMember.username,
					displayName: selectedMember.displayName,
					avatarUrl: selectedMember.avatarUrl,
				} : undefined}
				onClose={closeMemberPopover}
			/>

			<AddGroupMembersModal
				isOpen={isAddMembersOpen}
				friends={friends}
				existingMemberIds={Array.from(existingMemberIds)}
				isSubmitting={isSubmittingMembers}
				onClose={() => setIsAddMembersOpen(false)}
				onAdd={(userIds) => void handleAddMembers(userIds)}
			/>

			{isClearConfirmOpen && (
				<div className={styles["confirm-backdrop"]} onClick={() => setIsClearConfirmOpen(false)}>
					<div className={styles["confirm-modal"]} onClick={(event) => event.stopPropagation()}>
						<h3>Очистить сообщения?</h3>
						<p>
							Это действие удалит/очистит все сообщения комнаты для участников.
							Отменить его нельзя.
						</p>
						<div className={styles["confirm-actions"]}>
							<button type="button" onClick={() => setIsClearConfirmOpen(false)}>
								Отмена
							</button>
							<button type="button" onClick={() => void handleClearMessages()}>
								Очистить
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
