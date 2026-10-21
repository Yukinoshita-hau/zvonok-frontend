import type { User } from '../entities/user';

export function confirmedProfile(value: User): User {
  if (!value || typeof value.id !== 'number' || typeof value.username !== 'string' || typeof value.displayName !== 'string' || (value.aboutMe != null && typeof value.aboutMe !== 'string') || (value.avatarUrl != null && typeof value.avatarUrl !== 'string')) {
    throw new Error('Сервер не подтвердил профиль. Обновите данные перед повторной отправкой.');
  }
  return value;
}

export function profileRequestError(error: unknown): string {
  const failure = error as {response?: {status?: number; data?: {message?: string}}; message?: string};
  const status = failure?.response?.status;
  if (status === 401 || status === 403) return 'Нет доступа к профилю. Войдите в аккаунт повторно.';
  if (status === 409) return 'Конфликт обновления. Обновите профиль и повторите изменения.';
  if (status === 400 || status === 422) return 'Ошибка валидации. ' + (failure.response?.data?.message || 'Проверьте поля профиля.');
  if (!failure?.response) return 'Ошибка соединения или неподтверждённый ответ. ' + (failure?.message || 'Повторите попытку.');
  return failure.response?.data?.message || 'Не удалось сохранить профиль. Повторите попытку.';
}

export const AVATAR_READBACK_FAILED = 'Аватар принят сервером, но профиль не удалось перечитать. Загрузка не будет повторена. Обновите профиль.';
