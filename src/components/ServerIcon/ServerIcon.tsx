import styles from "./ServerIcon.module.css"
import cn from "classnames";
import serverIcon from "../../assets/base-server-icon.png";


export default function ServerIcon() {

	return (
		<button className={cn(styles["server-button"])}>
			<img src={serverIcon} alt="serverIcon" />
		</button>
	)
}
