import styles from "./MessagesSkeleton.module.css";
import cn from "classnames";

export function MessagesSkeleton() {
	return (
		<div className={styles["messages"]}>
			<div className={styles["data-divider"]} >
				<span className={cn(styles["data-label"], styles["shimmer"])}></span>
			</div>
			{[...Array(15)].map((el, i) => {
				return (
					<div key={i}
						className={styles["message-row"]}>
						<div className={cn(styles["msg-avatar"], styles["shimmer"])} />
						<div className={styles["msg-body"]}>
							<div className={styles["msg-meta"]}>
								<span className={cn(styles["msg-author"], styles["shimmer"])} style={{ width: `${40 + (i % 3) * 12}px` }}></span>
								<span className={cn(styles["msg-time"], styles["shimmer"])}></span>

							</div>
							<div className={cn(styles["msg-text"], styles["shimmer"])} style={{ width: `${80 + (i % 3) * 40}px` }}></div>
						</div>
					</div>
				)
			})}
		</div>
	)
}
