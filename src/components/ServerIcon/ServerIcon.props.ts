import type { ButtonHTMLAttributes } from "react";
import type { Server } from "../../entities/server";


export interface ServerIconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	server: Server;
}
