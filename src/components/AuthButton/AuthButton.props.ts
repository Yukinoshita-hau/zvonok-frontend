import type { ButtonHTMLAttributes, ReactNode } from "react";


export interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;	
}
