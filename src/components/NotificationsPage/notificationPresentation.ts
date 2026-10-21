import type { Notification } from '../../store/interfaces/notification.interface';

export function notificationRoute(target: Notification['target']): string | null {
  switch (target.type) {
    case 'CHAT': return `/dm?roomId=${target.roomId}`;
    case 'CALL_HISTORY': return target.roomId ? `/dm?roomId=${target.roomId}` : '/';
    case 'FRIEND_PROFILE':
    case 'FRIEND_REQUESTS': return '/';
    case 'SYSTEM': return null;
  }
}

export function notificationTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Время неизвестно' : date.toLocaleString('ru-RU', {
    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit',
  });
}
