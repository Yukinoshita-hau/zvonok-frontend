import type { AuthHeadlingProps } from "./AuthHeadling.props";
import cn from "classnames";
import styles from "./AuthHeadling.module.css";

export default function AuthHeadling({ children, className, type, ...props }: AuthHeadlingProps) {

	return (
		<h1 className={cn(styles["h1"], className, {
			[styles["login"]]: type === "login",
			[styles["register"]]: type === "register",
		})} {...props}>
			{children}
		</h1>
	)
}
