import { useMemo, useState } from "react";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import styles from "./SettingModal.module.css";
import cn from "classnames";
import type { SettingModalProps } from "./SettingModal.props";
import { navigateSections, SECTIONS } from "./SettingSections";
import { SettingSectionsSelector } from "../SettingSectionsSelector/SettingSectinoSelector";


export function SettingModal({ isOpen, onClose }: SettingModalProps) {
	const isVisible = useModalAnimation(isOpen);
	const [inputText, setInputText] = useState<string>("");

	const [currentSection, setCurrentSection] = useState<string>(SECTIONS.ACCOUNT);
	const filterNavigateSections = useMemo(() => {
		if (inputText?.trim() === "") return navigateSections;
		return navigateSections.filter(s => s.toLowerCase().includes(inputText.trim().toLowerCase()));
	}, [navigateSections, inputText])

	if (!isVisible) return null;

	return (
		<div
			className={styles["backdrop"]}
			data-state={isOpen ? "open" : "close"}
			onClick={onClose}
		>
			<div
				className={styles["modal"]}
				data-state={isOpen ? "open" : "close"}
				onClick={(e) => e.stopPropagation()}>
				<div className={styles["navigation-bar"]}>
					<input
						className={styles["input"]}
						placeholder="Поиск"
						onChange={(e) => setInputText(e.target.value)}
					/>
					{filterNavigateSections.map(n => (
						<button className={cn(styles["navigation-btn"], {
							[styles["active"]]: n === currentSection
						})} onClick={() => setCurrentSection(n)}>{n}</button>
					))}
				</div>
				<div className={styles["content"]}>
					<div className={styles["header"]}>
						{currentSection}
					</div>
					<SettingSectionsSelector sectionName={currentSection} />
				</div>
			</div>
		</div>
	)
}
