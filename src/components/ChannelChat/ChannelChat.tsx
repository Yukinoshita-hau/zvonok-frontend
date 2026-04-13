import { useParams } from "react-router-dom";
import styles from "./ChannelChat.module.css";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect, useState } from "react";
import { channelMessageActions, fetchChannelMessages } from "../../store/slices/channelMessage.slice";
import { Send } from "lucide-react";
import { ChannelItemList } from "../ChannelItemsList/ChannelItemList";

export function ChannelChat() {
	const { serverId, channelFolderId, channelId } = useParams();
	const dispatch = useDispatch<AppDispatch>();
	const { servers } = useSelector((s: RootState) => s.server);
	const [text, setText] = useState<string>("");

	const currentServer = servers?.find(s => s.id === Number(serverId));

	const currentChannelFolder = currentServer?.channelFolders.find(cf => cf.id === Number(channelFolderId));
	const currentChannel = currentChannelFolder?.channels.find(c => c.id === Number(channelId));

	useEffect(() => {
		dispatch(channelMessageActions.setActiveChannel(Number(channelId)))
		dispatch(fetchChannelMessages({
			serverId: Number(serverId),
			channelFolderId: Number(channelFolderId),
			channelId: Number(channelId)
		}))

		return () => {
			dispatch(channelMessageActions.setActiveChannel(null));
		}
	}, [dispatch, serverId, channelFolderId, channelId])

	const onSend = () => {
		if (!text.trim()) return;

		dispatch(channelMessageActions.sendChannelMessage({
			channelId: Number(channelId),
			content: text.trim()
		}))

		setText("");
	}

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") onSend();
	}

	return (
		<div className={styles["chat"]}>
			<div className={styles["header"]}>
				<div className={styles["header-left"]}>
					<div className={styles["avatar"]} />
					<span className={styles["title"]}>
						{currentChannel?.name}
					</span>
				</div>
				<div className={styles["header-right"]}>
					{/* Надо будет закинуться иконуи звонка / файла / поиска */}
				</div>
			</div>
			<ChannelItemList serverId={Number(serverId)} channelFolderId={Number(channelFolderId)} channelId={Number(channelId)} />
			<div className={styles["input-bar"]}>
				<input
					className={styles["input"]}
					placeholder="Message @here"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyPress}
				/>
				<button className={styles["message-button"]} onClick={onSend}>
					<Send color="white" size={20} />
				</button>
			</div>
		</div>

	)
}
