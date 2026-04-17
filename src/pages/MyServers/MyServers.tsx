import { useMemo, useState } from "react";
import { InboxHeaderButton } from "../../components/InboxHeaderButton/InboxHeaderButton";
import styles from "./MyServers.module.css";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { MyServersCard } from "../../components/MyServersCard/MyServersCard";
import { useNavigate } from "react-router-dom";

export type buttonModeType = "My Servers" | "Discover";

export function MyServers() {
	const navigate = useNavigate();
	const { servers } = useSelector((s: RootState) => s.server);
	const [buttonMode, setButtonMode] = useState<buttonModeType>("My Servers");
	const [inputText, setInputText] = useState("");

	const filterServers = useMemo(() => {
		if (inputText.trim() === "") return servers;
		return servers.filter(s => s.name.toLowerCase().includes(inputText.trim().toLowerCase()));
	}, [servers, inputText])

	return (
		<div className={styles["container"]}>
			<div className={styles["header"]}>
				<div className={styles["header-button"]}>
					<InboxHeaderButton isActive={buttonMode === "My Servers"} onClick={() => setButtonMode("My Servers")}>Мои сервера</InboxHeaderButton>
					<InboxHeaderButton isActive={buttonMode === "Discover"} onClick={() => setButtonMode("Discover")}>Найти</InboxHeaderButton>
				</div>
			</div>
			<div className={styles["area"]}>
				<div className={styles["area-input"]}>
					<input
						className={styles["input"]}
						placeholder="Найти сервер"
						onChange={(e) => setInputText(e.target.value)}
					/>
				</div>
				<div className={styles["server-area"]}>
					{filterServers?.map(s => (
						<MyServersCard
							server={s}
							onClick={() => navigate(`/server/${s.id}`)}
						/>
					))}
				</div>
			</div>
		</div>
	)
}
