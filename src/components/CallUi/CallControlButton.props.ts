import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface CallControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon: ReactNode;
	label: string;
	isActive?: boolean;
	isDanger?: boolean;
	showLabel?: boolean;
}
