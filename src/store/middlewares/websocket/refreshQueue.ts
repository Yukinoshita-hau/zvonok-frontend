/** One request in flight, plus a trailing authoritative refresh if events arrived
 * during it. No timer; events cannot be hidden by a snapshot started before them.
 * The caller supplies its connection/session-guarded dispatch for teardown.
 */
export function createRefreshQueue(refresh: () => Promise<unknown>) {
  let pending: Promise<void> | undefined;
  let dirty = false;
  return () => {
    dirty = true;
    if (!pending) {
      pending = (async () => {
        // Set pending before dispatching, including synchronous failures.
        await Promise.resolve();
        try {
          do {
            dirty = false;
            await refresh();
          } while (dirty);
        } finally {
          pending = undefined;
        }
      })();
    }
    return pending;
  };
}
