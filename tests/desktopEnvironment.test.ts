import { describe, expect, it } from 'vitest';
import { validateLocalDocker, localAssetPath } from '../electron/environment';
import profile from '../config/desktop-local-docker.json';

describe('LOCAL_DOCKER boundary', () => {
  it('rejects mixed endpoints, E6, production and profile contamination', () => {
    expect(validateLocalDocker(profile as Parameters<typeof validateLocalDocker>[0])).toEqual(profile);
    for (const patch of [{ api: 'http://127.0.0.1:18086/api' }, { livekit: 'ws://127.0.0.1:48886' }, { livekit: 'ws://localhost:8080' }, { websocket: 'ws://remote.test/api/ws-raw' }, { environment: 'PRODUCTION' }, { profile: '../zvonok-frontend' }]) {
      expect(() => validateLocalDocker({ ...profile, ...patch } as Parameters<typeof validateLocalDocker>[0])).toThrow();
    }
  });
  it('serves only assets from the exact web origin and prevents Windows path escapes', () => {
    const origin = profile.rendererOrigin;
    expect(localAssetPath(`${origin}/dm?roomId=1`, origin)).toBe('index.html');
    expect(localAssetPath(`${origin}/assets/app.js`, origin)).toBe('assets/app.js');
    for (const url of ['http://localhost:8080/api/auth/refresh', 'http://127.0.0.1:3000/', 'http://remote.test/', 'http://user:pass@localhost:3000/']) expect(localAssetPath(url, origin)).toBeNull();
    for (const pathname of ['/assets/%2e%2e%2fsecret', '/assets/%2e%2e%20/secret', '/assets/%5csecret', '/C%3a/secret', '/assets/%00', '//server/share']) expect(() => localAssetPath(origin + pathname, origin)).toThrow();
  });
});
