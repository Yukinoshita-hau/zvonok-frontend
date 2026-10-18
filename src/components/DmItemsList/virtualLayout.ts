export interface RowLayout {
  keys: string[];
  offsets: number[];
  total: number;
}
export function layoutRows(
  keys: string[],
  heights: ReadonlyMap<string, number>,
  estimate: (index: number) => number,
): RowLayout {
  const offsets: number[] = [];
  let total = 0;
  keys.forEach((key, index) => {
    offsets.push(total);
    total += heights.get(key) ?? estimate(index);
  });
  return { keys, offsets, total };
}
export function rowAt(layout: RowLayout, position: number) {
  let low = 0,
    high = layout.offsets.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (layout.offsets[mid] <= position) low = mid + 1;
    else high = mid;
  }
  return Math.max(0, low - 1);
}
export function anchoredScroll(
  previous: RowLayout,
  next: RowLayout,
  scrollTop: number,
) {
  let index = rowAt(previous, scrollTop);
  // Prefer the next visible row boundary so measuring the partial row above it
  // cannot move the already visible message during a prepend.
  if (previous.offsets[index] < scrollTop && index + 1 < previous.keys.length) index++;
  const nextPositions = new Map(next.keys.map((key, position) => [key, position]));
  let nextIndex = nextPositions.get(previous.keys[index]);
  if (nextIndex === undefined) {
    // Date dividers can be replaced on prepend; anchor to a surviving message instead.
    let surviving = index + 1;
    while (surviving < previous.keys.length && !nextPositions.has(previous.keys[surviving])) surviving++;
    if (surviving === previous.keys.length) {
      surviving = index - 1;
      while (surviving >= 0 && !nextPositions.has(previous.keys[surviving])) surviving--;
    }
    if (surviving < 0) return scrollTop;
    index = surviving;
    nextIndex = nextPositions.get(previous.keys[index]);
  }
  return nextIndex === undefined
    ? scrollTop
    : Math.max(
        0,
        next.offsets[nextIndex] + scrollTop - previous.offsets[index],
      );
}
