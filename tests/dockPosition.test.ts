import { describe, expect, it } from "vitest";
import { clampDock, snapDock } from "../src/components/ActiveCallOverlay/dockPosition";

describe("compact dock edge positioning", () => {
  it("snaps near an edge and keeps an interior position", () => {
    expect(snapDock(18, 22, 296, 180, 1024, 600)).toEqual({x:8,y:8});
    expect(snapDock(710, 401, 296, 180, 1024, 600)).toEqual({x:720,y:412});
    expect(snapDock(400, 200, 296, 180, 1024, 600)).toEqual({x:400,y:200});
  });
  it.each([[1920,1080],[1440,900],[1366,768],[1024,768],[1024,600],[1000,700]])("clamps after resize at %ix%i", (w,h) => {
    const p = snapDock(4000,4000,296,180,w,h);
    expect(p.x+296).toBe(w-8); expect(p.y+180).toBe(h-8);
    expect(clampDock(-500,-500,296,180,w,h)).toEqual({x:8,y:8});
  });
});
