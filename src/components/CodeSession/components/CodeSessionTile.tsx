import { Code2, Play, Sparkles } from "lucide-react";
import type { CodeSessionDto } from "../../../api/interfaces/codeSessionTypes";
import { StringToColor } from "../../../utils/stringHelpers";
import styles from "./CodeSessionTile.module.css";

interface CodeSessionTileProps {
	session: CodeSessionDto;
	className?: string;
	isFocused?: boolean;
	onOpen: () => void;
}

export function CodeSessionTile({ session, className, isFocused = false, onOpen }: CodeSessionTileProps) {
	const owner = getOwner(session);
	const ownerColor = StringToColor(owner || "code-session");
	const language = session?.language ?? "code";
	const lines = session?.code?.split("\n").slice(0, 5) ?? [
		"function solve(input) {",
		"  return input;",
		"}",
	];

	return (
		<button
			type="button"
			className={[className, styles.tile, isFocused ? styles.focused : ""].filter(Boolean).join(" ")}
			onClick={onOpen}
			title="Открыть Code Session"
		>
			<div className={styles.preview}>
				<div className={styles.glow} />
				<div className={styles.editorCard}>
					<div className={styles.editorTop}>
						<span />
						<span />
						<span />
						<strong>{getFileName(language)}</strong>
					</div>
					<div className={styles.codeLines}>
						{lines.map((line, index) => (
							<div key={`${index}-${line}`} className={styles.codeLine}>
								<span>{index + 1}</span>
								<code>{line || " "}</code>
							</div>
						))}
					</div>
				</div>
				<div className={styles.badge}>
					<Code2 size={14} />
				</div>
				<div className={styles.spark}>
					<Sparkles size={13} />
				</div>
				<div className={styles.runChip}>
					<Play size={11} />
					Run
				</div>
			</div>
			<div className={styles.name}>
				<span className={styles.title}>Code Session</span>
				<span className={styles.owner}>
					<span className={styles.ownerDot} style={{ backgroundColor: ownerColor }} />
					{owner || "live"}
				</span>
			</div>
		</button>
	);
}

function getOwner(session: CodeSessionDto): string {
	const editor = session?.activeEditor ?? session?.createdBy ?? null;
	if (!editor) return "";
	return typeof editor === "string" ? editor : editor.username;
}

function getFileName(language: string): string {
	if (language === "java") return "Main.java";
	if (language === "javascript") return "main.js";
	return `main.${language}`;
}
