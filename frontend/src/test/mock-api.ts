import { vi } from 'vitest';

type Route = [status: number, body: unknown];

// Подменяет fetch: ответ выбирается по «МЕТОД /путь», списки по умолчанию пусты
export function mockApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace('http://localhost:3000', '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const [status, body] =
      routes[key] ??
      (['GET /categories', 'GET /ads'].includes(key)
        ? [200, []]
        : [404, { message: key }]);
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), { status }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
