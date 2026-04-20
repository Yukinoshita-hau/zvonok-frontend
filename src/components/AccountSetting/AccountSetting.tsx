import { useDispatch, useSelector } from "react-redux";
import styles from "./AccountSetting.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import React, { useEffect, useRef, useState } from "react";
import type { UpdateUserDto } from "../../api/interfaces/UpdateUserDto";
import { logoutUser, updateUser, uploadAvatar } from "../../store/slices/user.slice";
import { fetchMyRooms } from "../../store/slices/room.slice";
import { fetchMyServers } from "../../store/slices/server.slice";
import { websocketActions } from "../../store/slices/websocket.slice";
import { useNavigate } from "react-router-dom";
import { UserProfileCard } from "../UserProfileCard/UserProfileCard";
import { StringToColor } from "../../utils/stringHelpers";

export function AccountSetting() {
	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const status = useSelector((s: RootState) => s.user.status);

	const [displayName, setDisplayName] = useState(myUser?.displayName || "");
	const [aboutMe, setAboutMe] = useState(myUser?.aboutMe || "");
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
	const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const username = myUser?.username || "";
	const avatarUrl = myUser?.avatarUrl || "";
	const avatarBg = StringToColor(username);
	const isUploading = status === "loading";

	useEffect(() => {
		return () => {
			if (previewAvatar) {
				URL.revokeObjectURL(previewAvatar);
			}
		};
	}, [previewAvatar]);

	const updateUserHandle = async (fields: Partial<UpdateUserDto>) => {
		setIsLoading(true);

		const body: UpdateUserDto = {
			displayName: fields.displayName ?? null,
			avatarUrl: fields.avatarUrl ?? null,
			aboutMe: fields.aboutMe ?? null,
		};

		try {
			await dispatch(updateUser(body)).unwrap();
			dispatch(websocketActions.connectStart());
			await dispatch(fetchMyRooms()).unwrap();
			await dispatch(fetchMyServers()).unwrap();
		} catch (error) {
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	};

	const logoutHandle = async (allDevices: boolean) => {
		try {
			await dispatch(logoutUser({ allDevices })).unwrap();
			navigate("/auth/login");
		} catch (error) {
			console.error(error);
		}
	};

	const onUpdateDisplayName = () => {
		if (displayName.length > 3) {
			updateUserHandle({ displayName });
		}
	};

	const onUpdateAboutMe = () => {
		if (aboutMe.length < 1000) {
			updateUserHandle({ aboutMe });
		}
	};

	const handlePickAvatarClick = () => {
		fileInputRef.current?.click();
	};

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			console.error("Нужно выбрать изображение");
			return;
		}

		if (previewAvatar) {
			URL.revokeObjectURL(previewAvatar);
		}

		const previewUrl = URL.createObjectURL(file);
		setSelectedAvatarFile(file);
		setPreviewAvatar(previewUrl);
	};

	const handleUploadAvatar = async () => {
		if (!selectedAvatarFile) return;

		try {
			await dispatch(uploadAvatar(selectedAvatarFile)).unwrap();

			if (previewAvatar) {
				URL.revokeObjectURL(previewAvatar);
			}

			setSelectedAvatarFile(null);
			setPreviewAvatar(null);

			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		} catch (e) {
			console.error("Avatar upload failed:", e);
		}
	};

	const handleCancelAvatar = () => {
		if (previewAvatar) {
			URL.revokeObjectURL(previewAvatar);
		}

		setSelectedAvatarFile(null);
		setPreviewAvatar(null);

		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const currentAvatarForPreview = previewAvatar || avatarUrl;
	console.log(currentAvatarForPreview)

	return (
		<div className={styles["container"]}>
			<div className={styles["tabs"]}>
				<button className={styles["tab-btn"]}>
					Основной профиль
				</button>
			</div>

			<div className={styles["content"]}>
				<div className={styles["edit-section"]}>
					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Отображаемое имя</label>
						<input
							className={styles["input"]}
							type="text"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="Введите имя..."
						/>
						{displayName !== myUser?.displayName && displayName.length > 3 && (
							<button
								className={styles["btn-primary"]}
								onClick={onUpdateDisplayName}
								disabled={isLoading}
							>
								{isLoading ? "Обновление..." : "Изменить имя"}
							</button>
						)}
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Обо мне</label>
						<input
							className={styles["input"]}
							type="text"
							value={aboutMe}
							onChange={(e) => setAboutMe(e.target.value)}
							placeholder="Введите описание"
						/>
						{aboutMe !== myUser?.aboutMe && aboutMe.length > 0 && (
							<button
								className={styles["btn-primary"]}
								onClick={onUpdateAboutMe}
								disabled={isLoading}
							>
								{isLoading ? "Обновление..." : "Применить описание"}
							</button>
						)}
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Аватар</label>

						<div className={styles["avatar-upload"]}>
							<div className={styles["avatar-upload-preview"]}>
								{currentAvatarForPreview ? (
									<img
										src={currentAvatarForPreview}
										crossOrigin="anonymous"
										alt="Avatar preview"
										className={styles["avatar-upload-image"]}
									/>
								) : (
									<div
										className={styles["avatar-upload-fallback"]}
										style={{ backgroundColor: avatarBg }}
									>
										{(displayName?.[0] || username?.[0] || "?").toUpperCase()}
									</div>
								)}
							</div>

							<div className={styles["avatar-upload-actions"]}>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleAvatarChange}
									className={styles["hidden-input"]}
								/>

								<button
									type="button"
									className={styles["btn-secondary"]}
									onClick={handlePickAvatarClick}
									disabled={isUploading}
								>
									Выбрать файл
								</button>

								{selectedAvatarFile && (
									<>
										<button
											type="button"
											className={styles["btn-primary"]}
											onClick={handleUploadAvatar}
											disabled={isUploading}
										>
											{isUploading ? "Загрузка..." : "Сохранить аватар"}
										</button>

										<button
											type="button"
											className={styles["btn-ghost"]}
											onClick={handleCancelAvatar}
											disabled={isUploading}
										>
											Отменить
										</button>
									</>
								)}

								{selectedAvatarFile && (
									<div className={styles["file-meta"]}>
										{selectedAvatarFile.name}
									</div>
								)}
							</div>
						</div>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Выйти из аккаунта</label>
						<div className={styles["logout-actions"]}>
							<button className={styles["btn-danger"]} onClick={() => logoutHandle(false)}>
								Выйти
							</button>
							<button className={styles["btn-danger"]} onClick={() => logoutHandle(true)}>
								Выйти везде
							</button>
						</div>
					</div>
				</div>

				<div className={styles["preview-section"]}>
					<div className={styles["preview-title"]}>Предпросмотр</div>
					<UserProfileCard
						displayName={displayName}
						username={username}
						avatarUrl={currentAvatarForPreview}
						avatarBg={avatarBg}
						aboutMe={aboutMe}
					/>
				</div>
			</div>
		</div>
	);
}
