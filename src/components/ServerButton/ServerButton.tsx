import type { ServerButtonProps } from "./ServerButton.props";
import styles from "./ServerButton.module.css";
import { useParams } from "react-router-dom";
import cn from "classnames";

export function ServerButton({ server, index, onClick }: ServerButtonProps) {
	const { serverId } = useParams();

	return (
		<button
			key={server.id}
			className={cn(styles["server-button"], {
				[styles["active"]]: Number(serverId) === server.id
			})}
			style={{ animationDelay: `${index * 80}ms` }}
			title={server.name}
			onClick={onClick}
		>
			<img src="../../../public/server-button-img2.png" alt={server.name} />
		</button>
	)
}
