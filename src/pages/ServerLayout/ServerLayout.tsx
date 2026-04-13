import { useSelector } from "react-redux";
import { Outlet, useParams } from "react-router-dom"
import type { RootState } from "../../store/store";
import styles from "./ServerLayout.module.css";
import { ChannelFolder } from "../../components/ChannelFolder/ChannelFolder";

export function ServerLayout() {
	const { serverId } = useParams();
	const { servers } = useSelector((s: RootState) => s.server);

	const currentServer = servers?.find(s => s.id === Number(serverId));

	if (!currentServer) {
		return (
			<div className={styles["empty-state"]}>
			</div>
		)
	}

	const sortedFolders = [...currentServer.channelFolders].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
	const textChannels = sortedFolders.flatMap(folder => folder.channels.filter(c => c.type === "TEXT"));
	const voiceChannels = sortedFolders.flatMap(folder => folder.channels.filter(c => c.type === "VOICE"));
	const activeTextChannel = textChannels[0]?.name ?? "general-chat";

	return (
		<div className={styles["layout"]}>
			<div className={styles["sidebar"]}>
				<div className={styles["cover"]} />
				<div className={styles["server-head"]}>
					{currentServer.name}
				</div>
				<div className={styles["channel-folders"]}>
					{sortedFolders.map(folder => (
						<ChannelFolder key={folder.id} folder={folder} serverId={Number(serverId)} />
					))}
				</div>
			</div>

			<section className={styles["chat"]}>
				<Outlet />
			</section>
		</div>
	)
}
