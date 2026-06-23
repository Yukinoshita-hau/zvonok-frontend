import { Copy, DoorOpen, Link2, Loader2, RadioTower, Sparkles, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { createConference, joinConference } from "../../store/slices/call.slice";
import { toastActions } from "../../store/slices/toast.slice";
import type { AppDispatch, RootState } from "../../store/store";
import { NavigateBarButton } from "../NavigateBarButton/NavigateBarButton";
import styles from "./ConferenceLauncher.module.css";

type ConferenceTab = "create" | "join";

export function ConferenceLauncher() {
	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();
	const location = useLocation();
	const conferenceCode = useSelector((s: RootState) => s.call.conferenceCode);
	const conferenceJoinUrl = useSelector((s: RootState) => s.call.conferenceJoinUrl);
	const isConferenceHost = useSelector((s: RootState) => s.call.isConferenceHost);
	const callStatus = useSelector((s: RootState) => s.call.status);
	const [isOpen, setIsOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [activeTab, setActiveTab] = useState<ConferenceTab>("create");
	const [joinCode, setJoinCode] = useState("");

	const shareUrl = useMemo(() => {
		if (conferenceJoinUrl) return conferenceJoinUrl;
		if (!conferenceCode) return "";
		return `${window.location.origin}/conference/${conferenceCode}`;
	}, [conferenceCode, conferenceJoinUrl]);

	const openModal = () => {
		setIsOpen(true);
		setActiveTab("create");
	};

	const createOrShowConference = async () => {
		if (conferenceCode && isConferenceHost) return;

		setIsCreating(true);
		try {
			await dispatch(createConference()).unwrap();
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "success",
				title: "Конференция создана",
				message: "Ссылка готова, можно отправлять участникам.",
			}));
		} catch (error) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "error",
				title: "Не удалось создать конференцию",
				message: typeof error === "string" ? error : "Попробуйте ещё раз.",
			}));
		} finally {
			setIsCreating(false);
		}
	};

	const submitJoinCode = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const normalizedCode = joinCode.trim();
		if (!normalizedCode) return;
		setIsOpen(false);
		const targetPath = `/conference/${encodeURIComponent(normalizedCode)}`;
		if (location.pathname === targetPath) {
			void dispatch(joinConference(normalizedCode));
			return;
		}
		navigate(targetPath);
	};

	const copyText = async (value: string, message: string) => {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "success",
				title: "Скопировано",
				message,
			}));
		} catch {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "warning",
				title: "Не удалось скопировать",
				message: "Выделите текст вручную.",
			}));
		}
	};

	return (
		<>
			<NavigateBarButton
				onClick={openModal}
				title="Конференции"
				aria-label="Конференции"
			>
				<RadioTower color="white" size={27} />
				<span className={styles["pulse"]} />
			</NavigateBarButton>

			{isOpen && (
				<div className={styles["backdrop"]} onMouseDown={() => setIsOpen(false)}>
					<section
						className={styles["modal"]}
						role="dialog"
						aria-modal="true"
						aria-labelledby="conference-title"
						onMouseDown={(event) => event.stopPropagation()}
					>
						<button
							type="button"
							className={styles["close"]}
							onClick={() => setIsOpen(false)}
							aria-label="Закрыть"
							title="Закрыть"
						>
							<X size={18} />
						</button>

						<div className={styles["hero"]}>
							<div className={styles["hero-icon"]}>
								{isCreating ? <Loader2 size={28} className={styles["spin"]} /> : <Sparkles size={28} />}
							</div>
							<div>
								<h2 id="conference-title">Быстрая конференция</h2>
								<p>
									Создай комнату по ссылке или войди в уже созданную конференцию по коду.
								</p>
							</div>
						</div>

						<div className={styles["tabs"]} role="tablist" aria-label="Режим конференции">
							<button
								type="button"
								className={styles["tab"]}
								data-active={activeTab === "create"}
								onClick={() => setActiveTab("create")}
							>
								Создать
							</button>
							<button
								type="button"
								className={styles["tab"]}
								data-active={activeTab === "join"}
								onClick={() => setActiveTab("join")}
							>
								Войти по коду
							</button>
						</div>

						{activeTab === "create" ? (
							<>
								<div className={styles["status-card"]} data-loading={isCreating || callStatus === "connecting"}>
									<span className={styles["status-dot"]} />
									<div>
										<div className={styles["status-title"]}>
											{isCreating ? "Создаём комнату LiveKit..." : conferenceCode ? "Комната готова" : "Готово к созданию"}
										</div>
										<div className={styles["status-copy"]}>
											{conferenceCode
												? "Вы уже подключены. Отправьте код или ссылку участникам."
												: "Комната создаётся только после нажатия кнопки ниже."}
										</div>
									</div>
								</div>

								<div className={styles["share-grid"]}>
									<label className={styles["share-field"]}>
										<span>Код</span>
										<div className={styles["copy-row"]}>
											<input value={conferenceCode ?? ""} readOnly placeholder="Создайте конференцию" />
											<button
												type="button"
												onClick={() => copyText(conferenceCode ?? "", "Код конференции в буфере.")}
												disabled={!conferenceCode}
												title="Скопировать код"
												aria-label="Скопировать код"
											>
												<Copy size={16} />
											</button>
										</div>
									</label>

									<label className={styles["share-field"]}>
										<span>Ссылка</span>
										<div className={styles["copy-row"]}>
											<input value={shareUrl} readOnly placeholder="Ссылка появится после создания" />
											<button
												type="button"
												onClick={() => copyText(shareUrl, "Ссылка конференции в буфере.")}
												disabled={!shareUrl}
												title="Скопировать ссылку"
												aria-label="Скопировать ссылку"
											>
												<Link2 size={16} />
											</button>
										</div>
									</label>
								</div>

								<div className={styles["actions"]}>
									<button
										type="button"
										className={styles["secondary"]}
										onClick={() => setIsOpen(false)}
									>
										Готово
									</button>
									<button
										type="button"
										className={styles["primary"]}
										onClick={shareUrl ? () => copyText(shareUrl, "Ссылка конференции в буфере.") : createOrShowConference}
										disabled={isCreating}
									>
										{isCreating ? <Loader2 size={16} className={styles["spin"]} /> : shareUrl ? <Copy size={16} /> : <RadioTower size={16} />}
										{shareUrl ? "Скопировать ссылку" : "Создать конференцию"}
									</button>
								</div>
							</>
						) : (
							<form className={styles["join-panel"]} onSubmit={submitJoinCode}>
								<div className={styles["status-card"]}>
									<span className={styles["status-dot"]} />
									<div>
										<div className={styles["status-title"]}>Вход по коду</div>
										<div className={styles["status-copy"]}>
											Вставьте код от друга. Если конференция активна, вы сразу подключитесь.
										</div>
									</div>
								</div>

								<label className={styles["share-field"]}>
									<span>Код конференции</span>
									<div className={styles["copy-row"]}>
										<input
											value={joinCode}
											onChange={(event) => setJoinCode(event.target.value)}
											placeholder="Например a1b2c3d4"
											autoFocus
										/>
										<button
											type="submit"
											disabled={!joinCode.trim()}
											title="Войти"
											aria-label="Войти"
										>
											<DoorOpen size={16} />
										</button>
									</div>
								</label>

								<div className={styles["actions"]}>
									<button
										type="button"
										className={styles["secondary"]}
										onClick={() => setIsOpen(false)}
									>
										Отмена
									</button>
									<button
										type="submit"
										className={styles["primary"]}
										disabled={!joinCode.trim()}
									>
										<DoorOpen size={16} />
										Войти
									</button>
								</div>
							</form>
						)}
					</section>
				</div>
			)}
		</>
	);
}
