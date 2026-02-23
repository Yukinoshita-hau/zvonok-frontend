import { useNavigate } from "react-router-dom";
import styles from "./NavigateBar.module.css";
import { ServerButton } from "../ServerButton/ServerButton";
import type { NavigateBarProps } from "./NavigateBar.props";
import { NavigateBarButton } from "../NavigateBarButton/NavigateBarButton";

export function NavigateBar({ servers }: NavigateBarProps) {
	const navigate = useNavigate();

	const goToDM = () => {
		navigate("/");
	}

	return <div className={styles["navigate-bar"]}>
		<div className={styles["top"]}>
			<NavigateBarButton onClick={goToDM}>
				<img src="../../../public/message-nav-icon.png" />
			</NavigateBarButton>
		</div>

		<div className={styles["divider"]} />

		<div className={styles["middle"]}>
			<NavigateBarButton>
				<img src="../../../public/server-all-list-icon.png" />
			</NavigateBarButton>
			{servers.map((server, index) => (
				<ServerButton
					key={server.id}
					index={index}
					server={server}
					onClick={() => navigate(`/servers/${server.id}`)}
				/>
			))}
		</div>

		<div className={styles["bottom"]}>
			<NavigateBarButton>
				<img src="../../../public/notify-icon.png" />
			</NavigateBarButton>
			<button className={styles["user-button"]}>U</button>
		</div>

	</div >
}
