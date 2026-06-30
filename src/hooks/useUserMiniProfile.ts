import { useCallback, useEffect, useState } from "react";
import type { UserMiniProfileDto } from "../api/interfaces/UserMiniProfileDto";
import { userApi } from "../api/userApi";

type MiniProfileStatus = "idle" | "loading" | "succeeded" | "failed";

export function useUserMiniProfile(userId: number | null, isOpen: boolean) {
	const [profile, setProfile] = useState<UserMiniProfileDto | null>(null);
	const [status, setStatus] = useState<MiniProfileStatus>("idle");
	const [error, setError] = useState<string | null>(null);

	const loadProfile = useCallback(async () => {
		if (!userId) return;

		setStatus("loading");
		setError(null);

		try {
			const { data } = await userApi.getMiniProfile(userId);
			setProfile(data);
			setStatus("succeeded");
		} catch (e: unknown) {
			setProfile(null);
			setError(e instanceof Error ? e.message : "Не удалось загрузить профиль");
			setStatus("failed");
		}
	}, [userId]);

	useEffect(() => {
		if (!isOpen || !userId) {
			setProfile(null);
			setStatus("idle");
			setError(null);
			return;
		}

		void loadProfile();
	}, [isOpen, loadProfile, userId]);

	return {
		profile,
		status,
		error,
		reload: loadProfile,
	};
}
