export const defaultNotificationPolicy = {
  messages: true, calls: true, messageSound: true, callSound: true, eventSound: true,
  preview: true, onlyUnfocused: false, dnd: false, allowCallsDuringDnd: false,
  exceptions: [] as { accountId: number; roomId: number }[],
};
export type NotificationPolicy = typeof defaultNotificationPolicy;
export function normalizeNotificationPolicy(raw: unknown): NotificationPolicy {
  const result = { ...defaultNotificationPolicy, exceptions: [] as NotificationPolicy['exceptions'] };
  if (!raw || typeof raw !== 'object') return result;
  const value = raw as Record<string, unknown>;
  for (const key of ['messages', 'calls', 'messageSound', 'callSound', 'eventSound', 'preview', 'onlyUnfocused', 'dnd', 'allowCallsDuringDnd'] as const) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  if (Array.isArray(value.exceptions)) result.exceptions = value.exceptions.filter(item => item && Number.isSafeInteger(item.accountId) && item.accountId > 0 && Number.isSafeInteger(item.roomId) && item.roomId > 0).map(({accountId, roomId}) => ({accountId, roomId}));
  return result;
}
export function notificationPresentation(device: { notificationPolicy?: NotificationPolicy; notificationSoundsEnabled?: boolean; desktopNotificationsEnabled?: boolean }, type: string, roomId?: number, accountId?: number, focused = false) {
  const policy = device.notificationPolicy ?? defaultNotificationPolicy;
  const category = type === 'call' ? policy.calls : type === 'message' ? policy.messages : true;
  const exception = type === 'message' && policy.exceptions.some(item => item.accountId === accountId && item.roomId === roomId);
  const quiet = policy.dnd && !(exception || type === 'call' && policy.allowCallsDuringDnd);
  return {
    sound: !quiet && device.notificationSoundsEnabled !== false && (type === 'call' ? policy.callSound : type === 'message' ? policy.messageSound : policy.eventSound),
    toast: !quiet && category && device.desktopNotificationsEnabled !== false && !(policy.onlyUnfocused && focused),
    preview: policy.preview,
  };
}
