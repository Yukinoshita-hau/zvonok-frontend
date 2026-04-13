import { useState } from "react";
import { ChevronDown, ChevronRight, Hash, Volume2 } from "lucide-react";
import styles from "./ChannelFolder.module.css";
import type { ChannelFolderProps } from "./ChannelFolder.props";
import { useNavigate } from "react-router-dom";

export function ChannelFolder({ folder, serverId }: ChannelFolderProps) {
	const [open, setOpen] = useState<boolean>(true);
	const navigate = useNavigate();

	return (
		<div className={styles["folder"]}>
			<div
				className={styles["folder-header"]}
				onClick={() => setOpen(!open)}
			>
				{open ? <ChevronDown size={16} /> : <ChevronRight
					size={16}
					className={`${styles["arrow"]} ${open ? styles["open"] : ""}`}
				/>}
				{folder.name}
			</div>

			{open && (
				<div className={styles["channels"]}>
					{folder.channels.map(channel => (
						<div key={channel.id} className={styles["channel"]} onClick={() => {
							navigate(`/servers/${serverId}/channel-folders/${folder.id}/channels/${channel.id}`)
						}}>
							{channel.type === "TEXT" && <Hash size={16} />}
							{channel.type === "VOICE" && <Volume2 size={16} />}
							<span>{channel.name}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
