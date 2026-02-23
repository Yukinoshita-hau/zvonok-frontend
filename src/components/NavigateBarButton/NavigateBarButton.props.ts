import type { ButtonHTMLAttributes, ReactNode } from "react";


export interface NavigateBarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
}
