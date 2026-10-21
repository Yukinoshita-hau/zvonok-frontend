import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { browserActivityError } from '../src/components/CallUi/BrowserActivity/browserActivityErrors';

const failure = (status: number) => new AxiosError('private stack / token must never reach UI', undefined, undefined, undefined, {
  status, statusText: '', data: {}, headers: {}, config: { headers: {} } as never,
});

describe('Browser Activity failure copy', () => {
  it('stops viewing on authentication and membership failures', () => {
    expect(browserActivityError(failure(401), 'poll')).toEqual({ revoked: true, message: 'Сеанс входа завершён. Войдите в Zvonok снова.' });
    expect(browserActivityError(failure(403), 'poll').revoked).toBe(true);
    expect(browserActivityError(failure(403), 'input').revoked).toBe(false);
    expect(browserActivityError(failure(503), 'poll').revoked).toBe(false);
  });
  it('distinguishes service, deployment and rate failures without exposing backend messages', () => {
    expect(browserActivityError(failure(503), 'create').message).toContain('Сервис браузера временно недоступен');
    expect(browserActivityError(failure(502), 'navigate').message).toContain('Страница не ответила');
    expect(browserActivityError(failure(503), 'navigate').message).toContain('Сервис браузера временно недоступен');
    expect(browserActivityError(failure(404), 'poll').message).toContain('версии сервера');
    expect(browserActivityError(failure(429), 'input').message).toContain('Подождите');
    expect(browserActivityError(failure(503), 'poll').message).not.toContain('private stack');
  });
  it('provides an actionable recovery for each command family and network loss', () => {
    for (const op of ['navigate', 'back', 'forward', 'reload']) expect(browserActivityError(Error('secret'), op).message).toContain('адрес');
    expect(browserActivityError(Error(), 'input').message).toContain('кто сейчас управляет');
    expect(browserActivityError(Error(), 'create').message).toContain('Повторите запуск');
    expect(browserActivityError(Error(), 'control/grant').message).toContain('управление');
    expect(browserActivityError(Error(), 'poll').message).toContain('Восстанавливаем');
  });
});

