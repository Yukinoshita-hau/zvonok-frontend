import { useEffect } from "react";

interface UseDismissibleLayerParams {
	isOpen: boolean;
	onDismiss: () => void;
	enabled?: boolean;
	dismissOnScroll?: boolean;
}

export function useDismissibleLayer({
	isOpen,
	onDismiss,
	enabled = true,
	dismissOnScroll = true,
}: UseDismissibleLayerParams) {
	useEffect(() => {
		if (!enabled || !isOpen) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onDismiss();
			}
		};

		const onWindowChange = () => {
			onDismiss();
		};

		window.addEventListener("keydown", onKeyDown);
		if (dismissOnScroll) {
			window.addEventListener("scroll", onWindowChange, true);
		}
		window.addEventListener("resize", onWindowChange);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			if (dismissOnScroll) {
				window.removeEventListener("scroll", onWindowChange, true);
			}
			window.removeEventListener("resize", onWindowChange);
		};
	}, [dismissOnScroll, enabled, isOpen, onDismiss]);
}
