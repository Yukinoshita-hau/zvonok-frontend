import { describe, expect, it } from "vitest";
import { calculateLayout, mediaAspectRatio, pageForAnchor, stableCardOrder, type LayoutCard } from "../src/components/CallUi/adaptiveLayout";

const cards = (count: number, ratio?: number): LayoutCard[] => Array.from({ length: count }, (_, i) => ({
  id: `person-${i}`, source: "camera", cameraPresent: ratio !== undefined, aspectRatio: ratio,
}));

describe("adaptive call geometry", () => {
  for (const [width, height] of [[1600, 850], [1100, 650], [700, 430], [744, 390], [200, 100]]) {
    for (let count = 1; count <= 20; count++) {
      it(`fits ${count} cards in ${width}×${height} without overlaps`, () => {
        const input = { width, height, cards: cards(count, 16 / 9) };
        const layout = calculateLayout(input);
        expect(layout).toEqual(calculateLayout(input));
        expect(layout.tiles.length).toBeGreaterThan(0);
        expect(layout.tiles.length).toBeLessThanOrEqual(layout.capacity);
        const availableHeight = height - (layout.pages > 1 ? 44 : 0);
        for (const tile of layout.tiles) {
          expect(tile.x).toBeGreaterThanOrEqual(-0.001);
          expect(tile.y).toBeGreaterThanOrEqual(-0.001);
          expect(tile.x + tile.width).toBeLessThanOrEqual(width + 0.001);
          expect(tile.y + tile.height).toBeLessThanOrEqual(availableHeight + 0.001);
          expect(tile.width / tile.height).toBeCloseTo(16 / 9);
          for (const other of layout.tiles.filter((t) => t.id !== tile.id)) {
            expect(tile.x + tile.width <= other.x + 0.001 || other.x + other.width <= tile.x + 0.001
              || tile.y + tile.height <= other.y + 0.001 || other.y + other.height <= tile.y + 0.001).toBe(true);
          }
        }
      });
    }
  }
  it("shows sixteen on a large stage, fewer in a small stage", () => {
    expect(calculateLayout({ width: 1600, height: 850, cards: cards(16) }).tiles).toHaveLength(16);
    expect(calculateLayout({ width: 700, height: 350, cards: cards(16) }).capacity).toBeLessThan(16);
  });
  it("uses balanced compositions and readable portrait widths", () => {
    expect(calculateLayout({ width: 1000, height: 600, cards: cards(4, 16 / 9) }).columns).toBe(2);
    expect(calculateLayout({ width: 1000, height: 500, cards: cards(6, 16 / 9) }).columns).toBe(3);
    const portrait = calculateLayout({ width: 700, height: 430, cards: cards(16, 9 / 16) });
    expect(portrait.pages).toBeGreaterThan(1);
    expect(portrait.tiles.every((tile) => tile.width >= 116)).toBe(true);
  });
  it.each([0, NaN, Infinity])("handles unusable measurement %s", (value) => {
    expect(calculateLayout({ width: value, height: 500, cards: cards(4) }).tiles).toEqual([]);
    expect(calculateLayout({ width: 500, height: value, cards: cards(4) }).tiles).toEqual([]);
  });
  it.each([16 / 9, 4 / 3, 1, 3 / 4, 9 / 16, undefined])("preserves source aspect %s", (aspectRatio) => {
    const result = calculateLayout({ width: 900, height: 500, cards: cards(4, aspectRatio) });
    for (const tile of result.tiles) expect(tile.width / tile.height).toBeCloseTo(aspectRatio ?? 16 / 9);
  });
  it("normalizes invalid metadata", () => {
    expect(mediaAspectRatio(0, 0)).toBeUndefined();
    expect(mediaAspectRatio(1080, 1920)).toBe(9 / 16);
  });
  it("keeps order on speaking, mute, camera changes and track replacement", () => {
    const original = cards(4);
    const changed = original.toReversed().map((c) => ({ ...c, cameraPresent: true, trackSid: "replacement", speaking: true }));
    expect(stableCardOrder(changed, original.map((c) => c.id)).map((c) => c.id)).toEqual(original.map((c) => c.id));
  });
  it("appends join/share and only compacts confirmed leaves", () => {
    expect(stableCardOrder([{ id: "new" }, { id: "b" }, { id: "a" }, { id: "screen:sid" }], ["a", "left", "b"]).map((c) => c.id))
      .toEqual(["a", "b", "new", "screen:sid"]);
  });
  it("retains page anchor after capacity change and clamps after leave", () => {
    const ids = cards(20).map((c) => c.id);
    expect(pageForAnchor(ids, 4, "person-8", 1)).toBe(2);
    expect(pageForAnchor(ids.slice(0, 3), 4, "person-8", 2)).toBe(0);
    expect(calculateLayout({ width: 700, height: 350, cards: cards(3), page: 99 }).page).toBe(0);
  });
  it("sizes Focus strip by its own container", () => {
    const result = calculateLayout({ width: 400, height: 140, cards: cards(12), strip: true });
    expect(result.capacity).toBe(3);
    expect(result.rows).toBe(1);
    expect(result.pages).toBe(4);
    const portrait = calculateLayout({ width: 400, height: 140, cards: cards(12, 9 / 16), strip: true });
    expect(portrait.tiles.every((tile) => tile.width >= 116)).toBe(true);
  });
});
