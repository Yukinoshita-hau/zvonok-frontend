import { forwardRef } from "react";
import type { AuthInputProps } from "./AuthInput.props";
import styles from "./AuthInput.module.css";
import cn from "classnames";


const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput({ className, ...props }, ref) {
	
	return (
		<input ref={ref} className={cn(styles["login"])} {...props}/>
	)
})

export default AuthInput;
