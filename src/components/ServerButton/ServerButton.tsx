import type { ServerButtonProps } from "./ServerButton.props";
import styles from "./ServerButton.module.css";
import { useParams } from "react-router-dom";
import cn from "classnames";

const serverButtonIconUrl = `${import.meta.env.BASE_URL}server-button-img2.png`;

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
			<img src={serverButtonIconUrl} alt={server.name} />
		</button>
	)
}
