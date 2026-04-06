import type { Room } from "../../entities/room";


export interface RoomSettingModalProps {
	isOpen: boolean;
	onClose: () => void;
	onStartCall: () => void;
	room: Room;
}
