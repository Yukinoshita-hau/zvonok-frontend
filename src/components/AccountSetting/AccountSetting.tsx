import { useDispatch, useSelector } from "react-redux";
import styles from "./AccountSetting.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { useState } from "react";
import type { UpdateUserDto } from "../../api/interfaces/UpdateUserDto";
import { logoutUser, updateUser } from "../../store/slices/user.slice";
import { fetchMyRooms } from "../../store/slices/room.slice";
import { fetchMyServers } from "../../store/slices/server.slice";
import { websocketActions } from "../../store/slices/websocket.slice";
import { useNavigate } from "react-router-dom";

export function AccountSetting() {
	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();
	const myUser = useSelector((s: RootState) => s.user.myUser);

	const [username, setUsername] = useState(myUser?.username || "");
	const [email, setEmail] = useState(myUser?.email || "");
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const updateUserHandle = async (fields: Partial<UpdateUserDto>) => {
		setIsLoading(true)
		const body: UpdateUserDto = {
			username: fields.username ?? null,
			email: fields.email ?? null,
			avatarUrl: fields.avatarUrl ?? null
		}
		try {
			await dispatch(updateUser(body)).unwrap();
			dispatch(websocketActions.connectStart());
			await dispatch(fetchMyRooms()).unwrap();
			await dispatch(fetchMyServers()).unwrap();
		} catch (error) {
			console.error(error);
		}

		setIsLoading(false)
	}

	const logoutHandle = async (allDevices: boolean) => {
		try {
			await dispatch(logoutUser({ allDevices: allDevices })).unwrap();
			navigate("/auth/login")
		} catch (error) {
			console.error(error);
		}
	}

	const onUpdateUsername = () => {
		if (username.length > 3) {
			updateUserHandle({ username })
		}
	}

	const onUpdateEmail = () => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (emailRegex.test(email)) {
			updateUserHandle({ email });
		} else {
			alert("Введите корректный email");
		}
	}

	return (
		<div className={styles["container"]}>
			{/* Вкладки (Основной профиль, личные профили сервера) */}
			<div className={styles["tabs"]}>
				<button className={`${styles["tab-btn"]}`}>
					Основной профиль
				</button>
			</div>

			<div className={styles["content"]}>
				{/* Левая колонка - форма редактирования */}
				<div className={styles["edit-section"]}>
					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Отображаемое имя</label>
						<input
							className={styles["input"]}
							type="text"
							value={username}
							onChange={e => setUsername(e.target.value)}
							placeholder="Введите имя..."
						/>
						{username !== myUser?.username && username.length > 3 &&
							<button
								className={styles["btn-primary"]}
								onClick={onUpdateUsername}
								disabled={isLoading}
							>
								{isLoading ? "Обновление..." : "Изменить имя"}
							</button>
						}
					</div>
					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Email</label>
						<input
							className={styles["input"]}
							type="text"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="Введите email..."
						/>
						{email !== myUser?.email && email.length > 5 &&
							<button
								className={styles["btn-primary"]}
								onClick={onUpdateEmail}
								disabled={isLoading}
							>
								{isLoading ? "Сохранение..." : "Изменить почту"}
							</button>
						}
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Выйти из аккаунта</label>
						<div className={styles["logout-actions"]}>
							<button className={styles["btn-danger"]} onClick={() => logoutHandle(false)}>Выйти</button>
							<button className={styles["btn-danger"]} onClick={() => logoutHandle(true)}>Выйти везде</button>
						</div>
					</div>
				</div>

				{/* Правая колонка - предпросмотр */}
				<div className={styles["preview-section"]}>
					<div className={styles["preview-title"]}>Предпросмотр</div>
					<div className={styles["preview-card"]}>
						<div className={styles["preview-banner"]}></div>
						<div className={styles["preview-body"]}>
							<div className={styles["preview-avatar-wrapper"]}>
								{/* Здесь будет реальная или дефолтная аватарка */}
								<div className={styles["preview-avatar"]}>
									{username?.[0]?.toUpperCase() || "?"}
								</div>
								<div className={styles["status-badge"]}></div>
							</div>

							<div className={styles["preview-info"]}>
								<div className={styles["preview-name"]}>
									{username || "User"}
								</div>
							</div>

							<div className={styles["preview-divider"]}></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
