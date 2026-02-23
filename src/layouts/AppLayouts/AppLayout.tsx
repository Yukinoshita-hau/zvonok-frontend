import { useEffect } from "react"
import { NavigateBar } from "../../components/NavigateBar/NavigateBar"
import styles from "./AppLayout.module.css"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "../../store/store";
import { fetchMyServers } from "../../store/slices/server.slice";
import { Outlet } from "react-router-dom";

export function AppLayout() {
	const dispatch = useDispatch<AppDispatch>();
	const { status, servers } = useSelector((s: RootState) => s.server)

	useEffect(() => {
		if (status === "idle") {
			dispatch(fetchMyServers());
		}
	}, [dispatch, status])

	return <div className={styles["layout"]}>
		<NavigateBar servers={servers ? servers : []} />
		<div className={styles["content"]}>
			<Outlet />
		</div>
	</div>
}
