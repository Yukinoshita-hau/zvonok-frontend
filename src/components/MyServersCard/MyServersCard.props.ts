import type { Server } from "../../entities/server";

export interface MyServersCardProps {
	server: Server;
	onClick: () => void;
}
