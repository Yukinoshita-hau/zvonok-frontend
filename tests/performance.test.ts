import { describe, expect, it, vi } from "vitest";
import { createRefreshQueue } from "../src/store/middlewares/websocket/refreshQueue";
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { resolve, promise };
};
describe("authoritative refresh queue", () => {
  it("coalesces a synchronous burst into one snapshot started after all events", async () => {
    const refresh = vi.fn(async () => {});
    const queue = createRefreshQueue(refresh);
    await Promise.all(Array.from({ length: 100 }, queue));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("resyncs once more for events received after the snapshot started", async () => {
    const first = deferred(),
      trailing = deferred();
    const refresh = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(trailing.promise);
    const queue = createRefreshQueue(refresh);
    const pending = queue();
    await Promise.resolve();
    for (let i = 0; i < 100; i++) queue();
    expect(refresh).toHaveBeenCalledTimes(1);
    first.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    trailing.resolve();
    await pending;
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("releases a failed request and allows subsequent recovery", async () => {
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const queue = createRefreshQueue(refresh);
    await expect(queue()).rejects.toThrow("offline");
    await queue();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("does not dispatch queued work after connection teardown", async () => {
    const first = deferred();
    let active = true;
    const request = vi.fn(() => first.promise);
    const queue = createRefreshQueue(async () => {
      if (active) await request();
    });
    const pending = queue();
    await Promise.resolve();
    queue();
    active = false;
    first.resolve();
    await pending;
    expect(request).toHaveBeenCalledTimes(1);
  });
});
