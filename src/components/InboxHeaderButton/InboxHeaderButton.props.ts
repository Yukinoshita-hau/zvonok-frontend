import type { ButtonHTMLAttributes, ReactNode } from "react";


export interface InboxHeaderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	isActive: boolean;
}
