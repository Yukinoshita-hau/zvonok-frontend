import type { RoomSettingButtonProps } from "./RoomSettingButton.props";
import styles from "./RoomSettingButton.module.css";

export function RoomSettingButton({ children, onClick }: RoomSettingButtonProps) {

	return (
		<button className={styles["btn"]} onClick={onClick}>
			{children}
		</button>
	)
}
