export type SplitArrangement = "auto" | "side" | "stacked";
export const clampSplitRatio = (ratio: number) => Number.isFinite(ratio) ? Math.max(30, Math.min(70, ratio)) : 50;

export function contentOrientation(width: number, height: number) {
  return width >= 760 && width > height * 1.25 ? "side" : "bottom";
}

export function splitOrientation(width: number, height: number, ratios: number[], arrangement: SplitArrangement) {
  if (arrangement !== "auto") return arrangement;
  const area = (w: number, h: number, ratio: number) => {
    const fitted = Math.min(w, h * ratio);
    return fitted * fitted / ratio;
  };
  const [a = 16 / 9, b = 16 / 9] = ratios;
  return area(width / 2, height, a) + area(width / 2, height, b)
    > area(width, height / 2, a) + area(width, height / 2, b) ? "side" : "stacked";
}

export function zoomGeometry(width: number, height: number, sourceWidth: number, sourceHeight: number, zoom: number | "fit") {
  const fit = Math.min(width / sourceWidth, height / sourceHeight);
  const scale = zoom === "fit" ? fit : zoom / 100;
  const w = sourceWidth * scale, h = sourceHeight * scale;
  return { width: w, height: h, panX: Math.max(0, (w - width) / 2), panY: Math.max(0, (h - height) / 2) };
}

export const clampPan = (value: number, bound: number) => Math.max(-bound, Math.min(bound, value));

export function resizeSplitWithKey(key: string, ratio: number, side: boolean) {
  if (key === "Home") return 50;
  if (key === (side ? "ArrowLeft" : "ArrowUp")) return clampSplitRatio(ratio - 5);
  if (key === (side ? "ArrowRight" : "ArrowDown")) return clampSplitRatio(ratio + 5);
  return null;
}
