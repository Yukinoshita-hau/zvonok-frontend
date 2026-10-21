import { useEffect, useState, type ReactNode } from "react";
import { isCancel } from 'axios';
import { session } from '../api/api';
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import authApi from "../api/authApi";
import { getMyUser, userActions } from "../store/slices/user.slice";
import { useThemeApplication } from "./useThemeApplication";
import { DesktopRuntimeBridge } from '../components/ActiveCallOverlay/DesktopRuntimeBridge';

export function AuthInitializator({ children }: { children: ReactNode }) {
	const dispatch = useDispatch<AppDispatch>();
	const { isAuthChecked } = useSelector((s: RootState) => s.user)
	useThemeApplication();
	const [recoveryError, setRecoveryError] = useState(false);
	const [retry, setRetry] = useState(0);
	useEffect(() => { void window.zvonokDesktop?.lifecycle?.ready?.().catch(() => {}); }, []);

	useEffect(() => {
		if (isAuthChecked) return;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const epoch = session.epoch;
		const run = async () => {
			if (!stopped) {
				try {
					await authApi.refresh();
					if (stopped || session.epoch !== epoch) return;
					await dispatch(getMyUser()).unwrap()
					if (stopped || session.epoch !== epoch) return;
					setRecoveryError(false);
					dispatch(userActions.setAuthChecked(true));
				} catch (e: unknown) {
					if (stopped || session.epoch !== epoch) return;
					if (isCancel(e)) { dispatch(userActions.setAuthChecked(true)); return; }
					setRecoveryError(true);
					timer = setTimeout(() => setRetry(value => value + 1), 15000);
				}
			}
		};

		void run();
		const resume = () => setRetry(value => value + 1);
		window.addEventListener('online', resume);
		const unsubscribe = window.zvonokDesktop?.onResume?.(resume);
		return () => { stopped = true; clearTimeout(timer); window.removeEventListener('online', resume); unsubscribe?.(); };
	}, [dispatch, isAuthChecked, retry])


	return <>{!isAuthChecked && recoveryError && <div role="status">Не удалось восстановить сессию. Проверьте соединение. <button type="button" onClick={() => setRetry(value => value + 1)}>Повторить</button></div>}{children}{window.zvonokDesktop && <DesktopRuntimeBridge />}</>
}
