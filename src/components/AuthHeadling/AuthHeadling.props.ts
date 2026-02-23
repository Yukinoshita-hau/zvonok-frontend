import type { HTMLAttributes, ReactNode } from "react";


export interface AuthHeadlingProps extends HTMLAttributes<HTMLHeadingElement> {
	children: ReactNode;	
	type: "login" | "register";
}
