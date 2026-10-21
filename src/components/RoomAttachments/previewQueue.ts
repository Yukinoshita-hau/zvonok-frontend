let active = 0;
const waiting: { run: () => Promise<void> }[] = [];
function pump() {
  while (active < 4 && waiting.length) {
    const job = waiting.shift()!;
    active++;
    void job.run().catch(() => {}).finally(() => { active--; pump(); });
  }
}
/** Bound both grant requests and image decoding across the visible library. */
export function queueImagePreview(run: () => Promise<void>) {
  const job = { run }; waiting.push(job); pump();
  return () => { const index = waiting.indexOf(job); if (index >= 0) waiting.splice(index, 1); };
}
