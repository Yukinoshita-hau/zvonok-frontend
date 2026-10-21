export interface LayoutCard {
  id: string;
  source: "camera" | "screen";
  cameraPresent: boolean;
  aspectRatio?: number;
}

export function mediaAspectRatio(width: number, height: number) {
  const ratio = width / height;
  return width > 0 && height > 0 && Number.isFinite(ratio)
    ? Math.max(0.4, Math.min(2.5, ratio))
    : undefined;
}

/** Retain existing slots; new sources append instead of displacing cameras. */
export function stableCardOrder<T extends { id: string }>(cards: T[], previousIds: string[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const result: T[] = [];
  for (const id of previousIds) {
    const card = byId.get(id);
    if (card) { result.push(card); byId.delete(id); }
  }
  return [...result, ...byId.values()];
}

export function pageForAnchor(ids: string[], capacity: number, anchor: string | null, fallback: number) {
  const index = anchor === null ? -1 : ids.indexOf(anchor);
  return Math.max(0, Math.min(
    index < 0 ? fallback : Math.floor(index / capacity),
    Math.max(0, Math.ceil(ids.length / capacity) - 1),
  ));
}

const GAP = 8;
export const PAGINATION_HEIGHT = 44;

export function calculateLayout({ width, height, cards, page = 0, strip = false,
  minWidth = 220, minHeight = 124,
}: {
  width: number; height: number; cards: LayoutCard[]; page?: number; strip?: boolean;
  minWidth?: number; minHeight?: number;
}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { capacity: 1, columns: 1, rows: 1, page: 0, pages: Math.max(1, cards.length), tiles: [] };
  }
  const columnsFit = Math.max(1, Math.floor((width + GAP) / ((strip ? 116 : minWidth) + GAP)));
  // Portrait tiles still need room for a readable name, even inside a wide cell.
  const readableHeight = Math.max(minHeight, ...cards.map((card) =>
    card.aspectRatio && card.aspectRatio < 1 ? 116 / card.aspectRatio : minHeight));
  const capacityAt = (availableHeight: number) => Math.min(16, columnsFit * (strip ? 1
    : Math.max(1, Math.floor((availableHeight + GAP) / (readableHeight + GAP)))));
  const needsPagination = cards.length > capacityAt(height);
  const availableHeight = Math.max(1, height - (needsPagination ? PAGINATION_HEIGHT : 0));
  const capacity = capacityAt(availableHeight);
  const pages = Math.max(1, Math.ceil(cards.length / capacity));
  const safePage = Math.max(0, Math.min(page, pages - 1));
  const visible = cards.slice(safePage * capacity, (safePage + 1) * capacity);
  const count = visible.length;
  let best = { score: -Infinity, columns: 1, rows: 1, cellWidth: width, cellHeight: availableHeight };
  for (let columns = 1; columns <= Math.min(Math.max(1, count), columnsFit); columns++) {
    const rows = Math.max(1, Math.ceil(count / columns));
    if (strip && rows > 1) continue;
    const cellWidth = Math.max(1, (width - GAP * (columns - 1)) / columns);
    const cellHeight = Math.max(1, (availableHeight - GAP * (rows - 1)) / rows);
    if (count > 1 && !strip && (cellWidth < minWidth || cellHeight < readableHeight)) continue;
    const score = visible.reduce((area, card) => {
      const ratio = strip ? 16 / 9 : card.aspectRatio ?? 16 / 9;
      const w = Math.min(cellWidth, cellHeight * ratio, count === 1 ? 960 : Infinity);
      return area + w * w / ratio;
    }, 0);
    if (score > best.score) best = { score, columns, rows, cellWidth, cellHeight };
  }
  // Pack the fitted cells together instead of spreading letterbox space into gaps.
  const fitted = visible.map((card) => {
    const ratio = strip ? 16 / 9 : card.aspectRatio ?? 16 / 9;
    const width = Math.min(best.cellWidth, best.cellHeight * ratio, count === 1 ? 960 : Infinity);
    return { width, height: width / ratio };
  });
  const cellWidth = Math.max(0, ...fitted.map((tile) => tile.width));
  const cellHeight = Math.max(0, ...fitted.map((tile) => tile.height));
  const top = (availableHeight - (best.rows * cellHeight + (best.rows - 1) * GAP)) / 2;
  const tiles = visible.map((card, index) => {
    const { width: tileWidth, height: tileHeight } = fitted[index];
    const row = Math.floor(index / best.columns);
    const inRow = Math.min(best.columns, count - row * best.columns);
    return {
      id: card.id, width: tileWidth, height: tileHeight,
      x: (width - (inRow * cellWidth + (inRow - 1) * GAP)) / 2
        + (index % best.columns) * (cellWidth + GAP) + (cellWidth - tileWidth) / 2,
      y: top + row * (cellHeight + GAP) + (cellHeight - tileHeight) / 2,
    };
  });
  return { capacity, columns: best.columns, rows: best.rows, page: safePage, pages, tiles };
}
