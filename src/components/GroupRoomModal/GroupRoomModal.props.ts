import type { CreateGroupBody } from "../../api/interfaces/CreateGroupBody";
import type { Friend } from "../../entities/friend";


export interface GroupRoomModalProps {
	isOpen: boolean; 
	friends: Friend[];
	onClose: () => void;
	onCreate: (body: CreateGroupBody) => void;
}
