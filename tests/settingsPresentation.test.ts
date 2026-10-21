import { describe, it, expect } from 'vitest';
import { notificationRoute, notificationTime } from '../src/components/NotificationsPage/notificationPresentation';
import { validateProfile } from '../src/components/AccountSetting/profileValidation';

describe('notification navigation', () => {
  it('uses the existing DM route', () => {
    expect(notificationRoute({type:'CHAT',roomId:42})).toBe('/dm?roomId=42');
    expect(notificationRoute({type:'CALL_HISTORY',roomId:42})).toBe('/dm?roomId=42');
  });
  it('does not navigate to nonexistent users or calls routes', () => {
    expect(notificationRoute({type:'FRIEND_PROFILE',username:'alice'})).toBe('/');
    expect(notificationRoute({type:'FRIEND_REQUESTS'})).toBe('/');
    expect(notificationRoute({type:'CALL_HISTORY'})).toBe('/');
    expect(notificationRoute({type:'SYSTEM'})).toBeNull();
  });
  it('handles invalid dates without crashing', () => {
    expect(notificationTime('invalid')).toBe('Время неизвестно');
    expect(notificationTime('2026-10-19T00:00:00Z')).not.toContain('2026-10-19T');
  });
});
describe('profile validation', () => {
  it('rejects empty or short names and long biographies', () => {
    expect(validateProfile('   ', '')).toBeTruthy();
    expect(validateProfile('ab', '')).toBeTruthy();
    expect(validateProfile('Alice', 'a'.repeat(1001))).toBeTruthy();
  });
  it('allows clearing an existing biography', () => {
    expect(validateProfile('Alice', '')).toBeNull();
    expect(validateProfile('Alice', 'a'.repeat(999))).toBeNull();
  });
});
