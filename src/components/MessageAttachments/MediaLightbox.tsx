import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./MessageAttachments.module.css";

interface MediaLightboxProps {
	src: string;
	alt: string;
	onClose: () => void;
}

export function MediaLightbox({ src, alt, onClose }: MediaLightboxProps) {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};

		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", onKeyDown);

		return () => {
			document.body.style.overflow = "";
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose]);

	return createPortal(
		<div className={styles["lightbox"]} onClick={onClose}>
			<button type="button" className={styles["lightbox-close"]} onClick={onClose} aria-label="Закрыть">
				<X size={22} />
			</button>
			<img src={src} alt={alt} className={styles["lightbox-image"]} onClick={(event) => event.stopPropagation()} />
		</div>,
		document.body
	);
}
