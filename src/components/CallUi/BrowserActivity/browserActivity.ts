export interface BrowserSession {
  sessionId: string; status: string; currentUrl: string; browserReady?: boolean; expiresAt: string;
  media?: { epoch: string; state: string };
  collaboration?: { identity: string; role: 'owner' | 'guest'; ownerPresent: boolean; controller: string;
    generation: number; epoch: string; expiresAt: number; serverTime: number; request?: string; result: string };
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

export function applyBrowserUpdate(previous: BrowserSession | null, next: BrowserSession) {
  if (!previous || previous.sessionId !== next.sessionId || previous.status !== 'active'
    || previous.media?.epoch !== next.media?.epoch
    || (next.collaboration?.generation ?? 0) < (previous.collaboration?.generation ?? 0)) return previous;
  return next;
}
// Fixed Slice 3 viewport; clicks in contain letterboxes never reach Chromium.
export function pageCoordinates(rect: {left:number;top:number;width:number;height:number}, clientX:number, clientY:number) {
  const scale=Math.min(rect.width/1280,rect.height/720);
  if(!Number.isFinite(scale) || scale<=0) return undefined;
  const x=(clientX-rect.left-(rect.width-1280*scale)/2)/scale;
  const y=(clientY-rect.top-(rect.height-720*scale)/2)/scale;
  if(x<0 || x>=1280 || y<0 || y>=720) return undefined;
  return {x:Math.floor(x),y:Math.floor(y)};
}
export function mediaState(width:number, fps:number) { return width < 1280 || fps < 10 ? 'Качество снижено' : 'Подключено · 720p15'; }
