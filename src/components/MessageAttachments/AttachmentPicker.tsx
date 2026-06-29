import { Paperclip } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import styles from "./MessageAttachments.module.css";

interface AttachmentPickerProps {
	disabled?: boolean;
	onSelectFiles: (files: FileList) => void;
}

export function AttachmentPicker({ disabled = false, onSelectFiles }: AttachmentPickerProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (files?.length) onSelectFiles(files);
		event.target.value = "";
	};

	return (
		<>
			<button
				type="button"
				className={styles["picker-button"]}
				disabled={disabled}
				title="Прикрепить изображение или видео"
				aria-label="Прикрепить изображение или видео"
				onClick={() => inputRef.current?.click()}
			>
				<Paperclip size={19} />
			</button>
			<input
				ref={inputRef}
				type="file"
				multiple
				accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
				className={styles["file-input"]}
				onChange={handleChange}
			/>
		</>
	);
}
