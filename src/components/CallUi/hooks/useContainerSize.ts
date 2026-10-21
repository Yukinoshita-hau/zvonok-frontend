import { useEffect, useRef, useState } from "react";

/** Observe the content box; coalesce resize notifications into one frame. */
export function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      // Hidden/minimized stages retain the last usable measurement.
      if (width <= 0 || height <= 0) return;
      frame = requestAnimationFrame(() => setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height }));
    });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return { ref, ...size };
}
