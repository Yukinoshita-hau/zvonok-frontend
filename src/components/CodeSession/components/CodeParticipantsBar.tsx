import type { CanvasParticipantOption } from "../../CallCanvas/CallCanvas.types";
import type { CodeAccessRole, CodeSessionUserDto } from "../../../api/interfaces/codeSessionTypes";
import styles from "../styles/CodeSessionPanel.module.css";

interface CodeParticipantsBarProps {
	role: CodeAccessRole;
	activeEditor: CodeSessionUserDto | null;
	participantOptions: CanvasParticipantOption[];
	canManageAccess: boolean;
	onGrantEditor: (username: string) => void;
	onRevokeEditor: () => void;
}

const ROLE_LABELS: Record<CodeAccessRole, string> = {
	HOST: "Host",
	EDITOR: "Редактор",
	VIEWER: "Просмотр",
};

export function CodeParticipantsBar({
	role,
	activeEditor,
	participantOptions,
	canManageAccess,
	onGrantEditor,
	onRevokeEditor,
}: CodeParticipantsBarProps) {
	const editorName = activeEditor?.displayName || activeEditor?.username || "никто";

	return (
		<div className={styles.participantsBar}>
			<div className={styles.accessSummary}>
				<span className={styles.liveBadge}>Live</span>
				<span className={styles.roleBadge}>{ROLE_LABELS[role]}</span>
				{role === "VIEWER" && <span className={styles.viewOnlyBadge}>Только просмотр</span>}
				<span className={styles.editorLabel}>Пишет: {editorName}</span>
			</div>

			{canManageAccess && (
				<div className={styles.accessControls}>
					<label className={styles.editorSelect}>
						<span>Передать управление</span>
						<select
							value={activeEditor?.username ?? ""}
							onChange={(event) => {
								const username = event.target.value;
								if (username) onGrantEditor(username);
							}}
						>
							<option value="">Выбрать участника</option>
							{participantOptions.map((participant) => (
								<option key={participant.username} value={participant.username}>
									{participant.displayName}
								</option>
							))}
						</select>
					</label>
					<button
						type="button"
						className={styles.accessButton}
						onClick={onRevokeEditor}
						disabled={!activeEditor}
					>
						Забрать
					</button>
				</div>
			)}
		</div>
	);
}
