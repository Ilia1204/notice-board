import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL, ApiError, apiRequest } from './client';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('API_URL', () => {
  it('по умолчанию указывает на локальный backend', () => {
    expect(API_URL).toBe('http://localhost:3000');
  });
});

describe('apiRequest', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('отправляет JSON и токен авторизации', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest('/auth/me', { method: 'POST', body: { a: 1 }, token: 't' }),
    ).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/me', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer t',
      },
      body: '{"a":1}',
    });
  });

  it('собирает ошибки валидации в одно сообщение', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          message: ['Некорректный email', 'Короткий пароль'],
        }),
      ),
    );
    await expect(apiRequest('/auth/register')).rejects.toEqual(
      new ApiError(400, 'Некорректный email. Короткий пароль'),
    );
  });

  it('сообщает, что сервер недоступен', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    await expect(apiRequest('/health')).rejects.toThrow('Сервер недоступен');
  });

  it('возвращает undefined для ответа без тела', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(
      apiRequest('/categories/1', { method: 'DELETE' }),
    ).resolves.toBe(undefined);
  });
});
