export function clampDock(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  return { x: Math.max(8, Math.min(Number.isFinite(x) ? x : 8, viewportWidth - width - 8)),
    y: Math.max(8, Math.min(Number.isFinite(y) ? y : 8, viewportHeight - height - 8)) };
}

export function snapDock(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const p = clampDock(x, y, width, height, viewportWidth, viewportHeight);
  const right = Math.max(8, viewportWidth - width - 8), bottom = Math.max(8, viewportHeight - height - 8);
  return { x: p.x - 8 < 20 ? 8 : right - p.x < 20 ? right : p.x,
    y: p.y - 8 < 20 ? 8 : bottom - p.y < 20 ? bottom : p.y };
}
