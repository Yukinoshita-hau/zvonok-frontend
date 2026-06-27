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
	HOST: "HOST",
	EDITOR: "EDITOR",
	VIEWER: "VIEWER",
};

export function CodeParticipantsBar({
	role,
	activeEditor,
	participantOptions,
	canManageAccess,
	onGrantEditor,
	onRevokeEditor,
}: CodeParticipantsBarProps) {
	return (
		<div className={styles.participantsBar}>
			<span className={styles.liveBadge}>Live</span>
			<span className={styles.roleBadge}>{ROLE_LABELS[role]}</span>
			{role === "VIEWER" && <span className={styles.viewOnlyBadge}>Only view</span>}
			<span className={styles.editorLabel}>
				Editing: {activeEditor?.displayName || activeEditor?.username || "никто"}
			</span>

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
