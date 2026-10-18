export function scheduleCallRecovery(attempt: () => Promise<unknown>, expired: () => void, startedAt: number,
	windowMs = 90000, retryMs = 5000) {
	let disposed = false;
	let timer: ReturnType<typeof setTimeout>;
	const recover = async () => {
		if (disposed) return;
		if (Date.now() - startedAt >= windowMs) { expired(); return; }
		try { await attempt(); } catch { /* Retry while the recovery window remains open. */ }
		if (!disposed) timer = setTimeout(recover, retryMs);
	};
	timer = setTimeout(recover, 1000);
	return () => { disposed = true; clearTimeout(timer); };
}
