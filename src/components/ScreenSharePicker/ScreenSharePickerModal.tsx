import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ScreenShareManualQuality } from "../../utils/callQuality";
import type {
	ScreenSharePickerResult,
	ScreenShareSource,
	ScreenShareSourceType,
} from "./ScreenSharePicker.types";
import {
	canUseSystemAudio,
	getDefaultScreenShareQuality,
	getScreenShareQualityPreset,
	getScreenShareSources,
	isZvonokDesktop,
} from "./screenSharePickerService";
import { ScreenShareQualitySelector } from "./ScreenShareQualitySelector";
import { ScreenShareSourceCard } from "./ScreenShareSourceCard";
import styles from "./ScreenSharePicker.module.css";

interface ScreenSharePickerModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (result: ScreenSharePickerResult) => void;
}

const SOURCE_TABS: Array<{ type: ScreenShareSourceType; label: string }> = [
	{ type: "screen", label: "Screens" },
	{ type: "window", label: "Windows" },
	{ type: "tab", label: "Tabs" },
];

export function ScreenSharePickerModal({ isOpen, onClose, onConfirm }: ScreenSharePickerModalProps) {
	const [sources, setSources] = useState<ScreenShareSource[]>([]);
	const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
	const [activeType, setActiveType] = useState<ScreenShareSourceType>("screen");
	const [selectedSource, setSelectedSource] = useState<ScreenShareSource | null>(null);
	const [quality, setQuality] = useState<ScreenShareManualQuality>(getDefaultScreenShareQuality());
	const [includeSystemAudio, setIncludeSystemAudio] = useState(false);

	const isDesktop = isZvonokDesktop();
	const isSystemAudioAvailable = canUseSystemAudio();
	const visibleTabs = useMemo(() => {
		return SOURCE_TABS.filter((tab) => isDesktop ? tab.type !== "tab" : tab.type !== "window");
	}, [isDesktop]);
	const visibleSources = sources.filter((source) => source.type === activeType);

	useEffect(() => {
		if (!isOpen) return;

		let isMounted = true;
		setStatus("loading");
		setSelectedSource(null);

		getScreenShareSources()
			.then((nextSources) => {
				if (!isMounted) return;
				setSources(nextSources);
				const firstSource = nextSources[0] ?? null;
				setSelectedSource(firstSource);
				setActiveType(firstSource?.type ?? "screen");
				setStatus("idle");
			})
			.catch(() => {
				if (!isMounted) return;
				setStatus("failed");
			});

		return () => {
			isMounted = false;
		};
	}, [isOpen]);

	if (!isOpen) return null;

	const handleConfirm = () => {
		if (!selectedSource) return;
		onConfirm({
			source: selectedSource,
			quality: getScreenShareQualityPreset(quality),
			includeSystemAudio: includeSystemAudio && isSystemAudioAvailable,
		});
	};

	const modal = (
		<div className={styles["modal-backdrop"]} onMouseDown={onClose}>
			<section className={styles["modal"]} onMouseDown={(event) => event.stopPropagation()}>
				<header className={styles["modal-header"]}>
					<div>
						<h2>Screen share</h2>
						<p>{isDesktop ? "Choose a screen or window to share." : "Choose options, then pick the source in the browser prompt."}</p>
					</div>
					<button type="button" className={styles["close-button"]} onClick={onClose} aria-label="Close">
						<X size={20} />
					</button>
				</header>

				<div className={styles["tabs"]}>
					{visibleTabs.map((tab) => (
						<button
							type="button"
							key={tab.type}
							data-active={activeType === tab.type}
							onClick={() => {
								setActiveType(tab.type);
								setSelectedSource(sources.find((source) => source.type === tab.type) ?? null);
							}}
						>
							{tab.label}
						</button>
					))}
				</div>

				<div className={styles["sources-panel"]}>
					{status === "loading" && (
						<div className={styles["source-grid"]}>
							{Array.from({ length: 4 }).map((_, index) => (
								<div className={styles["source-skeleton"]} key={index} />
							))}
						</div>
					)}
					{status === "failed" && <div className={styles["empty-state"]}>Could not load share sources.</div>}
					{status === "idle" && visibleSources.length === 0 && <div className={styles["empty-state"]}>No sources available.</div>}
					{status === "idle" && visibleSources.length > 0 && (
						<div className={styles["source-grid"]}>
							{visibleSources.map((source) => (
								<ScreenShareSourceCard
									key={source.id}
									source={source}
									isSelected={selectedSource?.id === source.id}
									onSelect={setSelectedSource}
								/>
							))}
						</div>
					)}
				</div>

				<div className={styles["settings-row"]}>
					<div className={styles["settings-block"]}>
						<span className={styles["section-label"]}>Quality</span>
						<ScreenShareQualitySelector value={quality} onChange={setQuality} />
					</div>
					<label className={styles["audio-toggle"]} data-disabled={!isSystemAudioAvailable}>
						<input
							type="checkbox"
							checked={includeSystemAudio}
							disabled={!isSystemAudioAvailable}
							onChange={(event) => setIncludeSystemAudio(event.target.checked)}
						/>
						<span>System audio</span>
					</label>
				</div>

				<footer className={styles["modal-footer"]}>
					<button type="button" className={styles["secondary-button"]} onClick={onClose}>
						Cancel
					</button>
					<button type="button" className={styles["primary-button"]} disabled={!selectedSource} onClick={handleConfirm}>
						Start sharing
					</button>
				</footer>
			</section>
		</div>
	);

	return createPortal(modal, document.body);
}
