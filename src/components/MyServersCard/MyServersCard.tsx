import styles from "./MyServersCard.module.css";
import type { MyServersCardProps } from "./MyServersCard.props";

export function MyServersCard({ server, onClick }: MyServersCardProps) {
	console.log(server.bannerUrl)
	return (
		<div className={styles["card"]} onClick={onClick}>
			<div className={styles["card-avatar"]}>
				<img src="http://localhost:8080/api/s3/download/aga1.png" crossOrigin="anonymous" alt={server.name} />
			</div>
			<div className={styles["card-info"]}>
				<div className={styles["card-info-name"]}>
					{server.name}
				</div>
				<div className={styles["card-info-meta"]}>
					{server.memberCount} Участника
				</div>
			</div>
		</div>
	)
}
