import { CheckCircle2, Link2, Loader2, TriangleAlert, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import { inviteApi } from "../../api/inviteApi";
import type { InvitePreviewDto } from "../../api/interfaces/InviteDtos";
import { fetchMyRooms } from "../../store/slices/room.slice";
import { toastActions } from "../../store/slices/toast.slice";
import type { AppDispatch } from "../../store/store";
import styles from "./InviteJoinPage.module.css";

type PageStatus = "loading" | "ready" | "joining" | "joined" | "failed";

export function InviteJoinPage() {
	const { token } = useParams<{ token: string }>();
	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();
	const [status, setStatus] = useState<PageStatus>("loading");
	const [preview, setPreview] = useState<InvitePreviewDto | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadPreview = async () => {
			if (!token) {
				setStatus("failed");
				setError("Invite-ссылка не найдена.");
				return;
			}

			setStatus("loading");
			setError(null);

			try {
				const { data } = await inviteApi.getPreview(token);
				setPreview(data);
				setStatus("ready");
			} catch (e: unknown) {
				setStatus("failed");
				setError(e instanceof Error ? e.message : "Invite-ссылка недоступна.");
			}
		};

		void loadPreview();
	}, [token]);

	const handleJoin = async () => {
		if (!token) return;

		setStatus("joining");
		try {
			const { data } = await inviteApi.join(token);
			await dispatch(fetchMyRooms());
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "success",
				title: "Вы вступили в группу",
				message: data.roomName ?? preview?.roomName ?? "Группа добавлена в список.",
			}));
			setStatus("joined");
			navigate(`/dm?roomId=${data.roomId}`);
		} catch (e: unknown) {
			setStatus("failed");
			setError(e instanceof Error ? e.message : "Не удалось вступить в группу.");
		}
	};

	const inviteStatus = preview?.status?.toUpperCase();
	const isAlreadyMember = inviteStatus === "ALREADY_MEMBER";
	const isInviteUnavailable = inviteStatus === "EXPIRED" || inviteStatus === "INVALID";
	const canJoin = Boolean(preview) && !isAlreadyMember && !isInviteUnavailable;

	return (
		<div className={styles.page}>
			<section className={styles.card}>
				<div className={styles.icon}>
					{status === "loading" || status === "joining" ? (
						<Loader2 className={styles.spin} size={30} />
					) : status === "failed" ? (
						<TriangleAlert size={30} />
					) : (
						<Link2 size={30} />
					)}
				</div>

				{status === "loading" && (
					<>
						<h1>Проверяем ссылку...</h1>
						<p>Загружаем информацию о группе.</p>
					</>
				)}

				{status === "failed" && (
					<>
						<h1>Invite недоступен</h1>
						<p>{error ?? "Ссылка устарела или была удалена."}</p>
						<Link className={styles.secondaryLink} to="/">
							Вернуться в Zvonok
						</Link>
					</>
				)}

				{preview && status !== "loading" && status !== "failed" && (
					<>
						<div className={styles.roomAvatar}>
							{preview.roomAvatarUrl ? (
								<img src={preview.roomAvatarUrl} alt={preview.roomName} />
							) : (
								<span>{preview.roomName[0]?.toUpperCase()}</span>
							)}
						</div>
						<h1>{preview.roomName}</h1>
						<p className={styles.meta}>
							<Users size={15} />
							{preview.membersCount} участников
							{preview.createdByDisplayName && ` • создал ${preview.createdByDisplayName}`}
						</p>

						{isAlreadyMember && (
							<div className={styles.notice}>
								<CheckCircle2 size={17} />
								Вы уже состоите в этой группе.
							</div>
						)}

						{inviteStatus === "EXPIRED" && (
							<div className={styles.noticeError}>Ссылка истекла.</div>
						)}

						<div className={styles.actions}>
							<button
								type="button"
								className={styles.primaryButton}
								disabled={!canJoin || status === "joining"}
								onClick={() => void handleJoin()}
							>
								{status === "joining" ? "Вступаем..." : "Вступить в группу"}
							</button>
							<Link className={styles.secondaryLink} to="/">
								Не сейчас
							</Link>
						</div>
					</>
				)}
			</section>
		</div>
	);
}
