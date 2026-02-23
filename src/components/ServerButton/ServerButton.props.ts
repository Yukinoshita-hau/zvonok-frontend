import type { ButtonHTMLAttributes } from "react";
import type { Server } from "../../entities/server";

export interface ServerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	server: Server;
	index: number;
}
