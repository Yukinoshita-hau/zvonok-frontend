export interface BrowserSession {
  sessionId: string; status: string; currentUrl: string; browserReady?: boolean; expiresAt: string;
  activeTabId?: string; tabs?: { id: string; url: string; title: string }[];
  media?: { epoch: string; state: string; profile?: string; width?: number; height?: number; fps?: number };
  collaboration?: { identity: string; role: 'owner' | 'guest'; ownerPresent: boolean; controller: string;
    generation: number; epoch: string; expiresAt: number; serverTime: number; request?: string; result: string; membershipExpiresAt?: number };
}
export interface BrowserActivity {
  activityId: string; callId: number; owner: boolean; joined: boolean; session: BrowserSession | null;
}
export interface BrowserMedia { url: string; token: string; epoch: string; sessionId: string; publisher: string }
export type InputAction = { type: 'mouseMove'; x: number; y: number }
  | { type: 'mouseClick'; x: number; y: number; button: 'left' | 'middle' | 'right' }
  | { type: 'wheel'; x: number; y: number; deltaX: number; deltaY: number }
  | { type: 'text'; text: string }
  | { type: 'keyPress'; key: 'Enter' | 'Tab' | 'Shift+Tab' | 'Backspace' | 'Delete' | 'Escape' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown' | 'Control+A' };

export function applyBrowserUpdate(previous: BrowserSession | null, next: BrowserSession, allowMediaEpochChange = false) {
  if (!previous || previous.sessionId !== next.sessionId || previous.status !== 'active'
    || (!allowMediaEpochChange && previous.media?.epoch !== next.media?.epoch)
    || (next.collaboration?.generation ?? 0) < (previous.collaboration?.generation ?? 0)) return previous;
  return next;
}
// Fixed Slice 3 viewport; clicks in contain letterboxes never reach Chromium.
export function pageCoordinates(rect: {left:number;top:number;width:number;height:number}, clientX:number, clientY:number, sourceWidth=1280, sourceHeight=720) {
  const scale=Math.min(rect.width/sourceWidth,rect.height/sourceHeight);
  if(!Number.isFinite(scale) || scale<=0) return undefined;
  const x=(clientX-rect.left-(rect.width-sourceWidth*scale)/2)/scale;
  const y=(clientY-rect.top-(rect.height-sourceHeight*scale)/2)/scale;
  if(x<0 || x>=sourceWidth || y<0 || y>=sourceHeight) return undefined;
  return {x:Math.floor(x),y:Math.floor(y)};
}
export function mediaState(width:number, height:number, fps:number, targetFps=24) {
  if (![width,height,fps].every(Number.isFinite) || width <= 0 || height <= 0 || fps < 0) return 'Ожидание статистики';
  return `${width < 1280 || height < 720 || fps < targetFps*0.95 ? 'Качество снижено' : 'Подключено'} · ${width}×${height} · ${Math.round(fps)} FPS`;
}
