import { describe, it, expect } from "vitest";
import { clampPan, clampSplitRatio, contentOrientation, resizeSplitWithKey, splitOrientation, zoomGeometry } from "../src/components/CallUi/contentGeometry";
describe("Stage C presentation geometry", () => {
  it("uses actual stage including chat reduction", () => {
    expect(contentOrientation(1100, 650)).toBe("side");
    expect(contentOrientation(540, 650)).toBe("bottom");
  });
  it("fits portrait and ultrawide without cropping or distorting", () => {
    for (const [sw, sh] of [[1920,1080],[1920,1200],[1200,900],[3440,1440],[1080,1920]]) {
      const fit = zoomGeometry(600,400,sw,sh,"fit");
      expect(fit.width).toBeLessThanOrEqual(600); expect(fit.height).toBeLessThanOrEqual(400);
      expect(fit.width/fit.height).toBeCloseTo(sw/sh); expect([fit.panX,fit.panY]).toEqual([0,0]);
    }
  });
  it("chooses split orientation by usable source area and respects manual arrangement", () => {
    expect(splitOrientation(1200,600,[9/16,9/16],"auto")).toBe("side");
    expect(splitOrientation(500,650,[32/9,32/9],"auto")).toBe("stacked");
    expect(splitOrientation(500,650,[],"side")).toBe("side");
    expect(splitOrientation(1200,600,[],"stacked")).toBe("stacked");
  });
  it("clamps drag and keyboard at 30/70 and resets", () => {
    expect([-100,30,50,70,100,NaN].map(clampSplitRatio)).toEqual([30,30,50,70,70,50]);
    expect(resizeSplitWithKey("ArrowLeft",30,true)).toBe(30);
    expect(resizeSplitWithKey("ArrowDown",65,false)).toBe(70);
    expect(resizeSplitWithKey("Home",70,true)).toBe(50);
    expect(resizeSplitWithKey("Escape",50,true)).toBeNull();
  });
  it("uses native pixels at 100%, bounds zoomed pan and resets to Fit", () => {
    expect(zoomGeometry(600,400,1920,1080,100).width).toBe(1920);
    const zoom = zoomGeometry(600,400,1920,1080,150);
    expect(zoom.width).toBe(2880); expect(clampPan(9000,zoom.panX)).toBe(1140);
    expect(clampPan(-9000,zoom.panY)).toBe(-610);
    expect(zoomGeometry(600,400,1920,1080,"fit").panX).toBe(0);
  });
});
