import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api/api';
import { applyBrowserUpdate, type BrowserActivity, type BrowserSession, type BrowserMedia } from './browserActivity';
import { browserActivityError } from './browserActivityErrors';

export function useBrowserActivity(callId: number | null, enabled: boolean) {
	const [activity, setActivity] = useState<BrowserActivity | null>(null);
	const [busy, setBusy] = useState(false), [error, setError] = useState(''), [connected, setConnected] = useState(false);
	const [notice, setNotice] = useState('');
	const [show, setShow] = useState(true), [declined, setDeclined] = useState<string>();
	const current = useRef(activity); current.current = activity;
	const context = useRef(callId); context.current = callId;
	const tail = useRef(Promise.resolve()), pending = useRef(0);
	const revision = useRef(0);
	const errorSource = useRef('');
	const reportError = useCallback((cause: unknown, operation: string) => {
		const failure = browserActivityError(cause, operation);
		errorSource.current = failure.revoked ? 'poll' : operation;
		setError(failure.message);
		if (failure.revoked) {
			revision.current++;
			current.current = null;
			setActivity(null); setConnected(false); setShow(false);
		}
	}, []);
	const clearPollError = useCallback(() => {
		if (errorSource.current === 'poll') { errorSource.current = ''; setError(''); }
	}, []);
	const base = `/calls/${callId}/browser-activity`;
	const command = useCallback(async (op: string, body: unknown = {}, expected = current.current) => {
		if (!expected || context.current !== callId) throw Error('Activity недоступна');
		const c = expected.session?.collaboration;
		const r = await api.post(`${base}/${expected.activityId}/commands`, { op, body, epoch: c?.epoch, generation: c ? String(c.generation) : undefined }, { timeout: 20000 });
		if (context.current !== callId || current.current?.activityId !== expected.activityId) throw Error('Activity завершена');
		return r.data;
	}, [base, callId]);
	const update = useCallback((session: BrowserSession) => setActivity(a => a ? { ...a, session: applyBrowserUpdate(a.session, session) } : a), []);
	useEffect(() => {
		setActivity(null); setConnected(false); setError(''); setNotice(''); errorSource.current = ''; setShow(true); setDeclined(undefined);
		if (!enabled || !callId) return;
		let stopped = false, polling = false;
		const poll = async () => {
			if (polling) return; polling = true;
			const expectedRevision = revision.current;
			try {
				const { data } = await api.get<BrowserActivity | null>(base, { timeout: 5000 });
				if (stopped || revision.current !== expectedRevision) return;
				if (!data) {
					if (current.current) setNotice('Совместный браузер завершён. Голосовой звонок продолжается.');
					current.current = null;
					setActivity(null); setConnected(false); clearPollError(); return;
				}
				setActivity(a => a?.activityId === data.activityId && a.session && data.session
					? { ...data, session: applyBrowserUpdate(a.session, data.session) } : data);
				current.current = data;
				if (data.joined && data.session?.status === 'active') {
					const next = await command('heartbeat', {}, data);
					if (!stopped && revision.current === expectedRevision) { update(next); setConnected(true); clearPollError(); }
				} else { setConnected(false); clearPollError(); }
			} catch (cause) { if (!stopped && revision.current === expectedRevision) { setConnected(false); reportError(cause, 'poll'); } }
			finally { polling = false; }
		};
		void poll(); const timer = setInterval(() => void poll(), 1000);
		return () => { stopped = true; clearInterval(timer); };
	}, [callId, enabled, base, command, update, reportError, clearPollError]);
	const perform = async (op: string) => {
		revision.current++;
		setBusy(true); setError(''); errorSource.current = '';
		if (op === 'create' || op === 'join') setNotice('');
		try {
			if (op === 'create') {
				const { data } = await api.post<BrowserActivity>(base, {}, { timeout: 20000 });
				if (context.current !== callId) return;
				setActivity(data); setShow(false); setConnected(true);
			} else {
				const next = await command(op);
				if (op === 'close') { current.current = null; setActivity(null); setShow(false); setNotice('Совместный браузер завершён. Голосовой звонок продолжается.'); }
				else if (op === 'leave') { setDeclined(current.current?.activityId); setActivity(a => a ? { ...a, joined: false, session: null } : a); setShow(false); setNotice('Вы вышли из совместного браузера. Голосовой звонок продолжается.'); }
				else if (op === 'join') { setActivity(a => a ? { ...a, joined: true, session: next } : a); setShow(true); setConnected(true); }
				else update(next);
			}
		} catch (cause) { if (context.current === callId) reportError(cause, op); }
		finally { if (context.current === callId) setBusy(false); }
	};
	const c = activity?.session?.collaboration;
	const canControl = connected && activity?.session?.status === 'active' && !!c && c.identity === c.controller && c.serverTime < c.expiresAt;
	const input = (op: string, body: unknown = {}) => {
		if (!canControl) return;
		if (op === 'input' && (body as { type?: string }).type === 'mouseMove' && pending.current >= 4) return;
		if (pending.current >= 16) { setError('Очередь ввода заполнена. Дождитесь обработки и повторите ввод.'); return; }
		const expected = current.current; pending.current++;
		tail.current = tail.current.then(async () => update(await command(op, body, expected)))
			.catch(cause => { if (context.current === callId) reportError(cause, op); })
			.finally(() => { pending.current--; });
		return tail.current;
	};
	const activityId = activity?.activityId, sessionId = activity?.session?.sessionId, epoch = activity?.session?.media?.epoch;
	const media = useCallback(async (): Promise<BrowserMedia> => {
		const result = await command('media');
		if (result.sessionId !== sessionId || result.epoch !== epoch) throw Error('Stale browser epoch');
		return result;
	}, [command, activityId, sessionId, epoch]);
	return { activity, busy, error, notice, connected, show, setShow, declined, decline: () => setDeclined(activity?.activityId), perform, input, canControl, media };
}
export type BrowserActivityState = ReturnType<typeof useBrowserActivity>;
