export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Ошибка ответа сервера с текстом, который можно показать пользователю
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: encodeBody(body),
    });
  } catch {
    throw new ApiError(0, 'Сервер недоступен. Попробуйте позже.');
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(data));
  }
  return data as T;
}

// FormData (форма с файлами) браузер кодирует сам, остальное отправляем как JSON
function encodeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body instanceof FormData) return body;
  return JSON.stringify(body);
}

// NestJS возвращает message строкой или массивом ошибок валидации
function errorMessage(data: unknown): string {
  const message = (data as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message ?? 'Не удалось выполнить запрос';
}
