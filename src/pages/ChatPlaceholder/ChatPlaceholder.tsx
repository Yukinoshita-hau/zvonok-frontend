import { useSelector } from "react-redux";
import { InboxHeaderButton } from "../../components/InboxHeaderButton/InboxHeaderButton";
import styles from "./ChatPlaceholder.module.css";
import type { RootState } from "../../store/store";
import { useState } from "react";
import { FriendRequestsList } from "../../components/FriendRequestsList/FriendRequestList";

export function ChatPlaceholder() {
	const incomingRequests = useSelector((s: RootState) => s.friend.incomingRequests);
	const outgoingRequest = useSelector((s: RootState) => s.friend.outgoingRequests);
	const [buttoneMode, setButtonMode] = useState<"incoming" | "outgoing">("incoming");

	return (
		<div className={styles["placeholder"]}>
			<div className={styles["header"]}>
				<InboxHeaderButton isActive={buttoneMode === "incoming"} onClick={() => setButtonMode("incoming")}>
					Входящие
				</InboxHeaderButton>
				<InboxHeaderButton isActive={buttoneMode === "outgoing"} onClick={() => setButtonMode("outgoing")}>
					Исходящие
				</InboxHeaderButton>
			</div>


			<div className={styles["list"]}>
				<div className={styles["label"]}>
					{buttoneMode === "incoming" ?
						`Входящие - ${incomingRequests.length}` :
						`Исходящие - ${outgoingRequest.length}`}
				</div>
				{<FriendRequestsList requestsList={buttoneMode === "incoming" ? incomingRequests : outgoingRequest} mode={buttoneMode} />}
			</div>

		</div>
	);
}
