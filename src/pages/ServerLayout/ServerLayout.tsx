import { useSelector } from "react-redux";
import { Outlet, useParams } from "react-router-dom"
import type { RootState } from "../../store/store";
import styles from "./ServerLayout.module.css";

export function ServerLayout() {
	const { serverId } = useParams();
	const { servers } = useSelector((s: RootState) => s.server);

	const currentServer = servers?.find(s => s.id === Number(serverId));

	if (!currentServer) {
		return (
			<div className={styles["empty-state"]}>
				<p>Сервер не найден</p>
			</div>
		)
	}

	const sortedFolders = [...currentServer.channelFolders].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
	const textChannels = sortedFolders.flatMap(folder => folder.channels.filter(c => c.type === "TEXT"));
	const voiceChannels = sortedFolders.flatMap(folder => folder.channels.filter(c => c.type === "VOICE"));
	const activeTextChannel = textChannels[0]?.name ?? "general-chat";

	return (
		<div className={styles["layout"]}>
			<aside className={styles["sidebar"]}>
				<div className={styles["cover"]} />

				<div className={styles["server-head"]}></div>

				<div className={styles["channels"]}></div>

				<div className={styles["channels"]}></div>
			</aside>

			<section className={styles["chat"]}>
			</section>
		</div>
	)
}
