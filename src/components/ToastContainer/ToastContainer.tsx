import { useDispatch, useSelector } from "react-redux";
import styles from "./ToastContainer.module.css";
import cn from "classnames";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect } from "react";
import { toastActions } from "../../store/slices/toast.slice";

export function ToastContainer() {
	const toasts = useSelector((s: RootState) => s.toast.items);
	const dispatch = useDispatch<AppDispatch>();

	useEffect(() => {
		if (toasts.length === 0) return;

		const timers = toasts.map(t =>
			setTimeout(() => {
				dispatch(toastActions.hideToast({ id: t.id }));
			}, 4000)
		);

		return () => {
			timers.forEach(clearTimeout)
		}
	}, [toasts, dispatch])

	return (
		<div className={styles["toast-root"]}>
			{toasts.map(t => (
				<div
					key={t.id}
					className={cn(styles["toast"], styles[t.type])}>
					{t.title && <div className={styles["toast-title"]}>{t.title}</div>}
					<div className={styles["toast-message"]}>{t.message}</div>
				</div>
			))}
		</div>
	)
}
