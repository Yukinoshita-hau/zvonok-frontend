import { useCallback, useEffect, useRef, useState } from "react";
import type { UserMiniProfileDto } from "../api/interfaces/UserMiniProfileDto";
import { userApi } from "../api/userApi";

type MiniProfileStatus = "idle" | "loading" | "succeeded" | "failed";

export function useUserMiniProfile(userId: number | null, isOpen: boolean) {
	const [profile, setProfile] = useState<UserMiniProfileDto | null>(null);
	const [status, setStatus] = useState<MiniProfileStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const request = useRef(0);

	const loadProfile = useCallback(async () => {
		if (!userId) return;
		const generation = ++request.current;

		setStatus("loading");
		setProfile(null);
		setError(null);

		try {
			const { data } = await userApi.getMiniProfile(userId);
			if (generation !== request.current) return;
			setProfile(data);
			setStatus("succeeded");
		} catch (e: unknown) {
			if (generation !== request.current) return;
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
		return () => { request.current++; };
	}, [isOpen, loadProfile, userId]);

	return {
		profile,
		status,
		error,
		reload: loadProfile,
	};
}
