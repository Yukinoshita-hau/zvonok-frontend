import { describe, expect, it } from "vitest";
import {
  anchoredScroll,
  layoutRows,
  rowAt,
} from "../src/components/DmItemsList/virtualLayout";
describe("variable-height history layout", () => {
  it("keeps the first visible message when prepend replaces its date divider", () => {
    const before = layoutRows(["divider-100", "100", "101"], new Map(), () => 50);
    const after = layoutRows(["divider-99", "99", "100", "101"], new Map(), () => 50);
    expect(anchoredScroll(before, after, 0)).toBe(50);
  });
  it("keeps a fully visible message while the partial row above it is measured", () => {
    const before = layoutRows(["older", "visible"], new Map(), () => 90);
    const after = layoutRows(["older", "visible"], new Map([["older", 74]]), () => 90);
    expect(anchoredScroll(before, after, 53)).toBe(37);
  });
  it("locates visible rows with variable image and text heights", () => {
    const layout = layoutRows(
      ["a", "image", "c"],
      new Map([
        ["a", 40],
        ["image", 500],
      ]),
      () => 80,
    );
    expect(layout.offsets).toEqual([0, 40, 540]);
    expect(layout.total).toBe(620);
    expect(rowAt(layout, 39)).toBe(0);
    expect(rowAt(layout, 40)).toBe(1);
    expect(rowAt(layout, 539)).toBe(1);
    expect(rowAt(layout, 540)).toBe(2);
  });
  it("preserves the same message and pixel offset on prepend", () => {
    const before = layoutRows(["a", "b", "c"], new Map(), () => 100);
    const after = layoutRows(["older", "a", "b", "c"], new Map(), () => 100);
    expect(anchoredScroll(before, after, 135)).toBe(235);
  });
  it("preserves scroll position when an image above the viewport expands", () => {
    const before = layoutRows(["image", "b", "c"], new Map(), () => 100);
    const after = layoutRows(
      ["image", "b", "c"],
      new Map([["image", 500]]),
      () => 100,
    );
    expect(anchoredScroll(before, after, 135)).toBe(535);
  });
  it("uses stable message keys when dates, edits and deleted rows change height", () => {
    const before = layoutRows(["day", "1", "2"], new Map(), () => 100);
    const after = layoutRows(
      ["newDay", "new", "day", "1", "2"],
      new Map([["1", 200]]),
      () => 100,
    );
    expect(anchoredScroll(before, after, 215)).toBe(515);
    expect(
      anchoredScroll(
        before,
        layoutRows([], new Map(), () => 100),
        215,
      ),
    ).toBe(215);
  });
});
