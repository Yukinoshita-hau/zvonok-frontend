import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  anchoredScroll,
  layoutRows,
  rowAt,
  type RowLayout,
} from "./virtualLayout";

/** Variable-height window. Keeps message data in Redux; only DOM is windowed. */
export function useVirtualRows<T extends { key: string; type: string }>(
  items: T[],
  container: RefObject<HTMLDivElement | null>,
  followBottom: boolean,
  pinnedKey?: string,
  minimumRows = 500,
) {
  const enabled = items.length >= minimumRows;
  const heights = useRef(new Map<string, number>());
  const elements = useRef(new Map<string, HTMLElement>());
  const observer = useRef<ResizeObserver | null>(null);
  const [revision, resize] = useState(0);
  const [viewport, setViewport] = useState({ top: 0, height: 800 });
  const previous = useRef<RowLayout | null>(null);
  const layout = useMemo(
    () =>
      layoutRows(
        items.map((item) => item.key),
        heights.current,
        (index) => (items[index].type === "divider" ? 42 : 90),
      ),
    [items, revision],
  );
  const latest = useRef(layout);
  latest.current = layout;
  const sync = useCallback(() => {
    const el = container.current;
    if (!el) return;
    setViewport((old) =>
      old.top === el.scrollTop && old.height === el.clientHeight
        ? old
        : { top: el.scrollTop, height: el.clientHeight },
    );
  }, [container]);
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const keys = new Set(layout.keys);
    heights.current.forEach((_, key) => {
      if (!keys.has(key)) heights.current.delete(key);
    });
    if (!enabled) {
      // Capture real geometry before a prepend crosses the windowing threshold.
      elements.current.forEach((element, key) => {
        const style = getComputedStyle(element);
        heights.current.set(
          key,
          element.offsetHeight +
            parseFloat(style.marginTop || "0") +
            parseFloat(style.marginBottom || "0"),
        );
      });
      previous.current = layoutRows(layout.keys, heights.current, (index) =>
        items[index].type === "divider" ? 42 : 90,
      );
      return;
    }
    if (followBottom) el.scrollTop = el.scrollHeight;
    else if (previous.current)
      el.scrollTop = anchoredScroll(previous.current, layout, el.scrollTop);
    previous.current = layout;
    sync();
  }, [enabled, layout, followBottom, container, sync, items]);
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = container.current;
    if (!el) return;
    let frame = 0;
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          sync();
        });
    };
    const rowObserver = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const key = (entry.target as HTMLElement).dataset.virtualKey;
        const height = (entry.target as HTMLElement).offsetHeight;
        if (key && height > 0 && heights.current.get(key) !== height) {
          heights.current.set(key, height);
          changed = true;
        }
      }
      if (changed) resize((value) => value + 1);
    });
    observer.current = rowObserver;
    elements.current.forEach((element) => rowObserver.observe(element));
    let width = el.clientWidth;
    const viewportObserver = new ResizeObserver(() => {
      // Width changes can invalidate offscreen estimates for wrapped text/images.
      if (width !== el.clientWidth) {
        width = el.clientWidth;
        heights.current.clear();
        resize((value) => value + 1);
      }
      schedule();
    });
    viewportObserver.observe(el);
    el.addEventListener("scroll", schedule, { passive: true });
    sync();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", schedule);
      rowObserver.disconnect();
      viewportObserver.disconnect();
      observer.current = null;
    };
  }, [enabled, container, sync]);
  const bind = useCallback((key: string, element: HTMLDivElement | null) => {
    const old = elements.current.get(key);
    if (old) observer.current?.unobserve(old);
    if (element) {
      elements.current.set(key, element);
      observer.current?.observe(element);
    } else elements.current.delete(key);
  }, []);
  const first = enabled ? rowAt(layout, Math.max(0, viewport.top - 600)) : 0;
  const last = enabled
    ? Math.min(
        items.length,
        rowAt(layout, viewport.top + viewport.height + 600) + 1,
      )
    : items.length;
  const indices = Array.from(
    { length: last - first },
    (_, index) => first + index,
  );
  const pinned = items.findIndex((item) => item.key === pinnedKey);
  if (enabled && pinned >= 0 && !indices.includes(pinned)) indices.push(pinned);
  const scrollTo = useCallback(
    (key: string) => {
      const current = latest.current,
        index = current.keys.indexOf(key),
        el = container.current;
      if (index < 0 || !el) return false;
      el.scrollTop = Math.max(0, current.offsets[index] - el.clientHeight / 2);
      sync();
      return true;
    },
    [container, sync],
  );
  return {
    enabled,
    total: layout.total,
    offsets: layout.offsets,
    rows: indices.map((index) => ({ item: items[index], index })),
    first,
    last,
    bind,
    scrollTo,
  };
}
