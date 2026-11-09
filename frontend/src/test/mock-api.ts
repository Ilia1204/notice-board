import { vi } from 'vitest';

type Route = [status: number, body: unknown];

// Подменяет fetch: ответ выбирается по «МЕТОД /путь», списки по умолчанию пусты
export function mockApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace('http://localhost:3000', '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const [status, body] = routes[key] ?? defaultRoute(key);
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), { status }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// Пустые списки и счётчик, чтобы каждому тесту не перечислять их заново
function defaultRoute(key: string): Route {
  if (['GET /categories', 'GET /ads', 'GET /favorites'].includes(key)) {
    return [200, []];
  }
  if (key === 'GET /chats/unread') return [200, { count: 0 }];
  if (/^POST \/chats\/\d+\/read$/.test(key)) return [204, null];
  return [404, { message: key }];
}
