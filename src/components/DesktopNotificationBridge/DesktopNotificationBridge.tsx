import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { AppDispatch } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { onDesktopNotificationClicked } from "../../services/desktop.service";

export function DesktopNotificationBridge() {
	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();

	useEffect(() => {
		return onDesktopNotificationClicked((payload) => {
			if (payload.roomId) {
				navigate(`/dm?roomId=${payload.roomId}`);
			}

			if (payload.callId) {
				dispatch(callActions.setPresentationMode("expanded"));
			}
		});
	}, [dispatch, navigate]);

	return null;
}
