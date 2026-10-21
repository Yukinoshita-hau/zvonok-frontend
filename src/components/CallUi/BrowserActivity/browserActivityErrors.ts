import { isAxiosError } from 'axios';

export function browserActivityError(error: unknown, operation: string) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401) return { revoked: true, message: 'Сеанс входа завершён. Войдите в Zvonok снова.' };
  if (status === 403 && (operation === 'poll' || operation === 'media')) return { revoked: true, message: 'Доступ к совместному браузеру отозван. Просмотр остановлен.' };
  if (status === 403) return { revoked: false, message: 'Действие недоступно. Проверьте, кто управляет браузером; обновляем права доступа.' };
  if (status === 404) return { revoked: false, message: 'Совместный браузер недоступен в этой версии сервера.' };
  if (status === 502 && ['navigate', 'back', 'forward', 'reload'].includes(operation)) return { revoked: false, message: 'Страница не ответила. Проверьте адрес или попробуйте другой сайт; браузер остаётся открыт.' };
  if (status === 503 || status === 502 || status === 504) return { revoked: false, message: 'Сервис браузера временно недоступен. Попробуйте позже; голосовой звонок продолжается.' };
  if (status === 429) return { revoked: false, message: 'Слишком много действий. Подождите немного и повторите.' };
  if (operation === 'poll') return { revoked: false, message: 'Связь с браузером потеряна. Восстанавливаем подключение…' };
  if (operation === 'navigate' || operation === 'back' || operation === 'forward' || operation === 'reload') {
    return { revoked: false, message: 'Не удалось открыть страницу. Проверьте адрес и право управления, затем повторите.' };
  }
  if (operation === 'input') return { revoked: false, message: 'Ввод отклонён. Проверьте, кто сейчас управляет браузером.' };
  if (operation === 'create') return { revoked: false, message: 'Браузер не запустился. Повторите запуск; если ошибка повторяется, попробуйте позже. Голосовой звонок продолжается.' };
  if (operation.startsWith('control/')) return { revoked: false, message: 'Не удалось изменить управление. Проверьте текущее состояние и повторите.' };
  return { revoked: false, message: 'Действие не выполнено. Обновляем состояние браузера; повторите после подключения.' };
}
