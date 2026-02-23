import styles from "./AuthButton.module.css";
import type { AuthButtonProps } from "./AuthButton.props";
import cn from "classnames";

export default function AuthButton({ children, className, ...props }: AuthButtonProps) {

	return (
		<button className={cn(styles["button"], className)} {...props}>
			{children}
		</button>
	);
}
