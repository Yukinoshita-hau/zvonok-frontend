import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../../store/store";
import { getNormalizedPoint } from "../../../utils/canvasCoordinates";
import { renderStrokes } from "../../../utils/canvasRenderer";
import { shouldSendCanvasPoint } from "../../../utils/canvasThrottle";
import { StringToColor } from "../../../utils/stringHelpers";
import { canvasActions, fetchCanvasSnapshot } from "../../../store/slices/canvas.slice";
import { selectCanvasPresenceEventByBoardId, selectCanvasStrokesByBoardId } from "../../../store/selectors/canvas.selectors";
import type {
	CanvasBoardSessionDto,
	CanvasDrawEventDto,
	CanvasInteractionTool,
	CanvasPointDto,
} from "../../../api/interfaces/CanvasDtos";
import type { LaserTrailState, RemoteCursorState } from "../DrawableCanvas/CanvasPresenceLayer";

interface UseCanvasDrawingParams {
	callId: number;
	board: CanvasBoardSessionDto;
	color: string;
	width: number;
	tool: CanvasInteractionTool;
	canDraw: boolean;
}

interface LocalCanvasCursorState {
	x: number;
	y: number;
	visible: boolean;
}

const CURSOR_THROTTLE_MS = 33;
const LASER_THROTTLE_MS = 24;
const CURSOR_STALE_MS = 2500;
const LASER_POINT_TTL_MS = 1200;
const CURSOR_MIN_DISTANCE = 0.0015;

export function useCanvasDrawing({
	callId,
	board,
	color,
	width,
	tool,
	canDraw,
}: UseCanvasDrawingParams) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const activeStrokeIdRef = useRef<string | null>(null);
	const isLaserActiveRef = useRef(false);
	const lastSentAtRef = useRef(0);
	const lastPointRef = useRef<CanvasPointDto | null>(null);
	const lastCursorSentAtRef = useRef(0);
	const lastCursorPointRef = useRef<CanvasPointDto | null>(null);
	const lastLaserSentAtRef = useRef(0);
	const [isDrawing, setIsDrawing] = useState(false);
	const [localCursor, setLocalCursor] = useState<LocalCanvasCursorState>({
		x: 0,
		y: 0,
		visible: false,
	});
	const [remoteCursorsByUserId, setRemoteCursorsByUserId] = useState<Record<string, RemoteCursorState>>({});
	const [laserTrailsByUserId, setLaserTrailsByUserId] = useState<Record<string, LaserTrailState>>({});
	const [presenceNow, setPresenceNow] = useState(() => Date.now());
	const dispatch = useDispatch<AppDispatch>();
	const userId = useSelector((state: RootState) => state.user.myUser?.username ?? "unknown");
	const strokes = useSelector((state: RootState) => selectCanvasStrokesByBoardId(state, board.id));
	const presenceEventState = useSelector((state: RootState) => selectCanvasPresenceEventByBoardId(state, board.id));

	const remoteCursors = useMemo(() => Object.values(remoteCursorsByUserId), [remoteCursorsByUserId]);
	const laserTrails = useMemo(() => Object.values(laserTrailsByUserId), [laserTrailsByUserId]);

	const publishEvent = useCallback((event: CanvasDrawEventDto, applyLocally = true) => {
		if (applyLocally) {
			dispatch(canvasActions.applyCanvasDrawEvent(event));
		}
		dispatch(canvasActions.sendCanvasDrawEvent({ callId, boardId: board.id, event }));
	}, [board.id, callId, dispatch]);

	const addLaserPoint = useCallback((event: CanvasDrawEventDto, fallbackUserId: string) => {
		if (event.x === null || event.y === null || event.x === undefined || event.y === undefined) return;

		const laserUserId = event.userId ?? fallbackUserId;
		const now = Date.now();
		const point = {
			id: `${laserUserId}-${now}-${Math.random().toString(36).slice(2)}`,
			userId: laserUserId,
			x: event.x,
			y: event.y,
			color: event.color ?? StringToColor(laserUserId),
			createdAt: now,
		};

		setLaserTrailsByUserId((current) => {
			const trail = current[laserUserId] ?? { userId: laserUserId, points: [], active: true };
			return {
				...current,
				[laserUserId]: {
					...trail,
					active: true,
					points: [...trail.points, point].slice(-36),
				},
			};
		});
	}, []);

	const sendCursorLeave = useCallback(() => {
		publishEvent({
			type: "CURSOR_LEAVE",
			boardId: board.id,
			userId,
			timestamp: new Date().toISOString(),
		}, false);
		lastCursorPointRef.current = null;
	}, [board.id, publishEvent, userId]);

	useEffect(() => {
		dispatch(fetchCanvasSnapshot({ callId, boardId: board.id }));
		dispatch(canvasActions.subscribeCanvasDrawEvents({ callId, boardId: board.id }));

		return () => {
			sendCursorLeave();
			dispatch(canvasActions.unsubscribeCanvasDrawEvents({ callId, boardId: board.id }));
		};
	}, [board.id, callId, dispatch, sendCursorLeave]);

	useEffect(() => {
		if (!presenceEventState) return;

		const event = presenceEventState.event;
		const eventUserId = event.userId;
		if (!eventUserId || eventUserId === userId) return;

		if (event.type === "CURSOR_MOVE") {
			if (event.x === null || event.y === null || event.x === undefined || event.y === undefined) return;

			setRemoteCursorsByUserId((current) => ({
				...current,
				[eventUserId]: {
					userId: eventUserId,
					x: event.x ?? 0,
					y: event.y ?? 0,
					color: StringToColor(eventUserId),
					updatedAt: Date.now(),
				},
			}));
			return;
		}

		if (event.type === "CURSOR_LEAVE") {
			setRemoteCursorsByUserId((current) => {
				const next = { ...current };
				delete next[eventUserId];
				return next;
			});
			return;
		}

		if (event.type === "LASER_POINT") {
			addLaserPoint(event, eventUserId);
			return;
		}

		if (event.type === "LASER_END") {
			setLaserTrailsByUserId((current) => {
				const trail = current[eventUserId];
				if (!trail) return current;
				return {
					...current,
					[eventUserId]: {
						...trail,
						active: false,
					},
				};
			});
		}
	}, [addLaserPoint, presenceEventState, userId]);

	useEffect(() => {
		if (!canvasRef.current) return;
		renderStrokes(canvasRef.current, strokes);
	}, [strokes]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const observer = new ResizeObserver(() => renderStrokes(canvas, strokes));
		observer.observe(canvas);

		return () => observer.disconnect();
	}, [strokes]);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			const now = Date.now();
			setPresenceNow(now);
			setRemoteCursorsByUserId((current) => {
				const entries = Object.entries(current).filter(([, cursor]) => now - cursor.updatedAt <= CURSOR_STALE_MS);
				return Object.fromEntries(entries);
			});
			setLaserTrailsByUserId((current) => {
				const next = Object.fromEntries(
					Object.entries(current)
						.map(([trailUserId, trail]) => [
							trailUserId,
							{
								...trail,
								points: trail.points.filter((point) => now - point.createdAt <= LASER_POINT_TTL_MS),
							},
						] as const)
						.filter(([, trail]) => trail.active || trail.points.length > 0)
				);
				return next;
			});
		}, 120);

		return () => window.clearInterval(intervalId);
	}, []);

	const sendCursorMove = useCallback((point: CanvasPointDto) => {
		const now = performance.now();
		const previousPoint = lastCursorPointRef.current;
		if (now - lastCursorSentAtRef.current < CURSOR_THROTTLE_MS) return;
		if (previousPoint) {
			const dx = point.x - previousPoint.x;
			const dy = point.y - previousPoint.y;
			if (Math.sqrt(dx * dx + dy * dy) < CURSOR_MIN_DISTANCE) return;
		}

		lastCursorSentAtRef.current = now;
		lastCursorPointRef.current = point;
		publishEvent({
			type: "CURSOR_MOVE",
			boardId: board.id,
			userId,
			x: point.x,
			y: point.y,
			timestamp: new Date().toISOString(),
		}, false);
	}, [board.id, publishEvent, userId]);

	const sendLaserPoint = useCallback((point: CanvasPointDto, force = false) => {
		const now = performance.now();
		if (!force && now - lastLaserSentAtRef.current < LASER_THROTTLE_MS) return;
		lastLaserSentAtRef.current = now;

		const event: CanvasDrawEventDto = {
			type: "LASER_POINT",
			boardId: board.id,
			userId,
			x: point.x,
			y: point.y,
			color,
			timestamp: new Date().toISOString(),
		};
		addLaserPoint(event, userId);
		publishEvent(event, false);
	}, [addLaserPoint, board.id, color, publishEvent, userId]);

	const sendLaserEnd = useCallback(() => {
		if (!isLaserActiveRef.current) return;

		isLaserActiveRef.current = false;
		setIsDrawing(false);
		setLaserTrailsByUserId((current) => {
			const trail = current[userId];
			if (!trail) return current;
			return {
				...current,
				[userId]: {
					...trail,
					active: false,
				},
			};
		});
		publishEvent({
			type: "LASER_END",
			boardId: board.id,
			userId,
			timestamp: new Date().toISOString(),
		}, false);
	}, [board.id, publishEvent, userId]);

	const finishStroke = useCallback(() => {
		if (!activeStrokeIdRef.current) return;

		const drawEvent: CanvasDrawEventDto = {
			type: "STROKE_END",
			boardId: board.id,
			strokeId: activeStrokeIdRef.current,
			userId,
			timestamp: new Date().toISOString(),
		};

		activeStrokeIdRef.current = null;
		lastPointRef.current = null;
		setIsDrawing(false);
		publishEvent(drawEvent);
	}, [board.id, publishEvent, userId]);

	useEffect(() => {
		if (canDraw) return;
		setLocalCursor((current) => ({ ...current, visible: false }));
		sendLaserEnd();
		finishStroke();
	}, [canDraw, finishStroke, sendLaserEnd]);

	const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (event.button !== 0) return;

		event.currentTarget.setPointerCapture(event.pointerId);
		const point = getNormalizedPoint(event, event.currentTarget);
		setLocalCursor({ ...point, visible: canDraw });
		sendCursorMove(point);
		if (!canDraw) return;

		if (tool === "LASER") {
			isLaserActiveRef.current = true;
			setIsDrawing(true);
			sendLaserPoint(point, true);
			return;
		}

		const strokeId = crypto.randomUUID();
		const drawEvent: CanvasDrawEventDto = {
			type: "STROKE_START",
			boardId: board.id,
			strokeId,
			userId,
			x: point.x,
			y: point.y,
			color,
			width,
			tool,
			timestamp: new Date().toISOString(),
		};

		activeStrokeIdRef.current = strokeId;
		lastSentAtRef.current = performance.now();
		lastPointRef.current = point;
		setIsDrawing(true);
		publishEvent(drawEvent);
	}, [board.id, canDraw, color, publishEvent, sendCursorMove, sendLaserPoint, tool, userId, width]);

	const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
		const point = getNormalizedPoint(event, event.currentTarget);
		setLocalCursor({ ...point, visible: canDraw });
		sendCursorMove(point);
		if (!canDraw) return;

		if (tool === "LASER") {
			if (isLaserActiveRef.current) {
				sendLaserPoint(point);
			}
			return;
		}

		if (!activeStrokeIdRef.current) return;
		const now = performance.now();

		if (!shouldSendCanvasPoint(lastSentAtRef.current, lastPointRef.current, point, now)) {
			return;
		}

		const drawEvent: CanvasDrawEventDto = {
			type: "STROKE_POINT",
			boardId: board.id,
			strokeId: activeStrokeIdRef.current,
			userId,
			x: point.x,
			y: point.y,
			timestamp: new Date().toISOString(),
		};

		lastSentAtRef.current = now;
		lastPointRef.current = point;
		publishEvent(drawEvent);
	}, [board.id, canDraw, publishEvent, sendCursorMove, sendLaserPoint, tool, userId]);

	const handlePointerEnd = useCallback(() => {
		if (tool === "LASER" || isLaserActiveRef.current) {
			sendLaserEnd();
			return;
		}

		finishStroke();
	}, [finishStroke, sendLaserEnd, tool]);

	const handlePointerLeave = useCallback(() => {
		setLocalCursor((current) => ({ ...current, visible: false }));
		sendCursorLeave();
		handlePointerEnd();
	}, [handlePointerEnd, sendCursorLeave]);

	return {
		canvasRef,
		isDrawing,
		localCursor,
		remoteCursors,
		laserTrails,
		presenceNow,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp: handlePointerEnd,
		handlePointerLeave,
		handlePointerCancel: handlePointerEnd,
	};
}
