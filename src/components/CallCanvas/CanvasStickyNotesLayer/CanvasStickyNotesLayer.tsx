import { useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import type { CanvasNoteVoteDto, CanvasStickyNoteDto } from "../../../api/interfaces/CanvasDtos";
import styles from "./CanvasStickyNotesLayer.module.css";

interface CanvasStickyNotesLayerProps {
	notes: CanvasStickyNoteDto[];
	votes: CanvasNoteVoteDto[];
	currentUsername: string;
	canDraw: boolean;
	onUpdateNote: (noteId: number, patch: Partial<CanvasStickyNoteDto>) => void;
	onDeleteNote: (noteId: number) => void;
	onToggleVote: (noteId: number, hasVoted: boolean) => void;
}

interface DragState {
	noteId: number;
	offsetX: number;
	offsetY: number;
}

export function CanvasStickyNotesLayer({
	notes,
	votes,
	currentUsername,
	canDraw,
	onUpdateNote,
	onDeleteNote,
	onToggleVote,
}: CanvasStickyNotesLayerProps) {
	const [draftTextById, setDraftTextById] = useState<Record<number, string>>({});
	const [localPositions, setLocalPositions] = useState<Record<number, { x: number; y: number }>>({});
	const [dragState, setDragState] = useState<DragState | null>(null);

	const votesByNoteId = useMemo(() => {
		const map = new Map<number, CanvasNoteVoteDto[]>();
		votes.forEach((vote) => {
			map.set(vote.noteId, [...(map.get(vote.noteId) ?? []), vote]);
		});
		return map;
	}, [votes]);

	const sortedNotes = useMemo(
		() => [...notes].sort((left, right) => left.zIndex - right.zIndex),
		[notes]
	);

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (!dragState) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const x = clamp01((event.clientX - rect.left - dragState.offsetX) / Math.max(1, rect.width));
		const y = clamp01((event.clientY - rect.top - dragState.offsetY) / Math.max(1, rect.height));
		setLocalPositions((current) => ({
			...current,
			[dragState.noteId]: { x, y },
		}));
	};

	const finishDrag = () => {
		if (!dragState) return;
		const position = localPositions[dragState.noteId];
		if (position) {
			onUpdateNote(dragState.noteId, position);
		}
		setDragState(null);
	};

	const deleteNote = (noteId: number) => {
		setDraftTextById((current) => {
			const next = { ...current };
			delete next[noteId];
			return next;
		});
		setLocalPositions((current) => {
			const next = { ...current };
			delete next[noteId];
			return next;
		});
		if (dragState?.noteId === noteId) {
			setDragState(null);
		}
		onDeleteNote(noteId);
	};

	return (
		<div
			className={styles.layer}
			onPointerMove={handlePointerMove}
			onPointerUp={finishDrag}
			onPointerCancel={finishDrag}
		>
			{sortedNotes.map((note) => {
				const position = localPositions[note.id] ?? { x: note.x, y: note.y };
				const noteVotes = votesByNoteId.get(note.id) ?? [];
				const hasVoted = noteVotes.some((vote) => vote.userId === currentUsername);
				const draftText = draftTextById[note.id] ?? note.text;

				return (
					<div
						key={note.id}
						className={styles.note}
						style={{
							left: `${position.x * 100}%`,
							top: `${position.y * 100}%`,
							width: `${Math.max(0.08, note.width) * 100}%`,
							height: `${Math.max(0.07, note.height) * 100}%`,
							zIndex: note.zIndex,
							"--note-color": note.color,
						} as CSSProperties}
					>
						<div
							className={styles.noteHandle}
							onPointerDown={(event) => {
								if (!canDraw) return;
								const rect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
								if (!rect) return;
								event.currentTarget.setPointerCapture(event.pointerId);
								setDragState({
									noteId: note.id,
									offsetX: event.clientX - (rect.left + position.x * rect.width),
									offsetY: event.clientY - (rect.top + position.y * rect.height),
								});
							}}
						>
							<span>{note.createdBy}</span>
							{canDraw && (
								<button
									type="button"
									onPointerDown={(event) => event.stopPropagation()}
									onClick={(event) => {
										event.stopPropagation();
										deleteNote(note.id);
									}}
									aria-label="Удалить заметку"
									title="Удалить заметку"
								>
									×
								</button>
							)}
						</div>
						<textarea
							value={draftText}
							disabled={!canDraw}
							onChange={(event) => setDraftTextById((current) => ({
								...current,
								[note.id]: event.target.value,
							}))}
							onBlur={() => {
								if (draftText !== note.text) onUpdateNote(note.id, { text: draftText });
							}}
							aria-label="Текст заметки"
						/>
						<div className={styles.noteFooter}>
							<button
								type="button"
								className={hasVoted ? styles.voteActive : styles.vote}
								onPointerDown={(event) => event.stopPropagation()}
								onClick={(event) => {
									event.stopPropagation();
									onToggleVote(note.id, hasVoted);
								}}
								aria-label={hasVoted ? "Убрать голос" : "Голосовать"}
							>
								● {noteVotes.length}
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}
