import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { MicOff, Minimize2, Settings, Signal } from "lucide-react";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import { StringToColor } from "../../utils/stringHelpers";
import { SettingModal } from "../SettingModal/SettingModal";
import { UserMiniProfileModal } from "../UserMiniProfileModal/UserMiniProfileModal";
import styles from "./ShellUserPanel.module.css";

export function ShellUserPanel() {
	const dispatch = useDispatch<AppDispatch>();
	const user = useSelector((s: RootState) => s.user.myUser);
	const call = useSelector((s: RootState) => s.call);
	const wsStatus = useSelector((s: RootState) => s.websocket.status);
	const dnd = useSelector((s: RootState) => s.device.notificationPolicy.dnd);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [profileOpen, setProfileOpen] = useState(false);
	const avatar = resolveMediaUrl(user?.avatarUrl);
	const active = call.status === "connecting" || call.status === "in_call";
	const connected = call.mediaState === "connected";

	return (
		<>
			<section
				className={styles.panel}
				data-compact={active && call.presentationMode !== "expanded"}
				aria-label="Панель пользователя"
				hidden={
					active &&
					call.presentationMode === "expanded" &&
					(call.isCallFocusMode || call.isTheaterMode)
				}
			>
				{active && (
					<div className={styles.call}>
						<button
							className={styles.connection}
							title="Открыть звонок"
							aria-label="Открыть звонок"
							onClick={() => {
								if (call.presentationMode === "expanded" || !call.participantToken) dispatch(callActions.setPresentationMode("expanded"));
								else {
									dispatch(callActions.setPresentationMode("minimized"));
									requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("[data-call-dock] button")?.focus({ preventScroll: true }));
								}
							}}
						>
							<Signal size={18} />
							<span>
								<strong>{call.mediaOwnership === "PASSIVE" ? "Другой клиент" : connected ? "На связи" : "Подключение…"}</strong>
								<small>
									{call.mediaOwnership === "PASSIVE"
										? "На другом клиенте"
										: "Голосовой звонок"}
								</small>
							</span>
						</button>
						{call.presentationMode === "expanded" && <button
							className={styles.icon}
							aria-label="Свернуть звонок"
							title="Свернуть звонок"
							onClick={() =>
								dispatch(callActions.setPresentationMode("minimized"))
							}
						>
							<Minimize2 size={17} />
						</button>}
					</div>
				)}
				<div className={styles.user}>
					<button
						className={styles.profile}
						title="Мой профиль"
						onClick={() => setProfileOpen(true)}
					>
						<span
							className={styles.avatar}
							style={{ background: StringToColor(user?.username ?? "") }}
						>
							{avatar ? (
								<img src={avatar} alt="" />
							) : (
								(
									user?.displayName?.[0] ||
									user?.username?.[0] ||
									"Z"
								).toUpperCase()
							)}
							<i data-online={wsStatus === "connected"} />
						</span>
						<span className={styles.identity}>
							<strong>{user?.displayName || user?.username}</strong>
							<small role="status" title={dnd ? 'Не беспокоить включён' : undefined}>
								{dnd ? 'Не беспокоить · ' : ''}{wsStatus === "connected" ? "В сети" : "Нет связи с сервером"}
							</small>
						</span>
					</button>
					<div id="shell-microphone" className={styles.microphone}>
						<button
							className={styles.fallback}
							disabled
							title="Микрофон доступен в активном звонке"
							aria-label="Микрофон доступен в активном звонке"
						>
							<MicOff size={18} />
						</button>
					</div>
					<button
						className={styles.icon}
						title="Настройки пользователя"
						aria-label="Настройки пользователя"
						onClick={() => setSettingsOpen(true)}
					>
						<Settings size={18} />
					</button>
				</div>
			</section>
			<SettingModal
				isOpen={settingsOpen}
				onClose={() => setSettingsOpen(false)}
			/>
			<UserMiniProfileModal
				userId={user?.id ?? null}
				isOpen={profileOpen}
				onClose={() => setProfileOpen(false)}
			/>
		</>
	);
}
