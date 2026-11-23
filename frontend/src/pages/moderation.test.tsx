import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const moderator = {
  id: 1,
  email: 'moderator@board.local',
  name: 'Модератор',
  role: 'MODERATOR',
};
const bike = {
  id: 1,
  title: 'Велосипед',
  description: 'Горный, 21 скорость',
  price: 15000,
  status: 'PENDING',
  category: { id: 3, name: 'Транспорт' },
  author: { id: 2, name: 'Иван' },
  images: [{ id: 11, filename: 'a.jpg' }],
  createdAt: '2026-11-01T10:00:00.000Z',
};
// Диван прислан позже — после правки он встаёт в очередь заново
const sofa = {
  ...bike,
  id: 2,
  title: 'Диван',
  price: null,
  images: [],
  updatedAt: '2026-11-05T10:00:00.000Z',
};

function openQueue(user: object, routes = {}) {
  localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = '#/moderation';
  const fetchMock = mockApi({
    'GET /auth/me': [200, user],
    'GET /ads/moderation': [200, [bike, sofa]],
    ...routes,
  });
  render(<App />);
  return fetchMock;
}

const itemOf = async (title: string) =>
  (await screen.findByRole('heading', { name: title })).closest('li')!;

describe('модерация', () => {
  beforeEach(() => localStorage.clear());

  it('обычному пользователю недоступна', async () => {
    openQueue({ ...moderator, role: 'USER' });
    expect(
      await screen.findByText('Раздел доступен только модераторам.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Модерация' })).toBeNull();
  });

  it('показывает объявление целиком', async () => {
    openQueue(moderator);
    const item = within(await itemOf('Велосипед'));
    expect(item.getByText(/15\s000 ₽/)).toBeInTheDocument();
    expect(
      item.getByText(/^Транспорт · Иван · отправлено 1 ноября/),
    ).toBeInTheDocument();
    expect(item.getByText(bike.description)).toBeInTheDocument();
    expect(
      item.getByRole('img', { name: 'Велосипед, фото 1' }),
    ).toHaveAttribute('src', 'http://localhost:3000/uploads/a.jpg');
    expect(screen.getByRole('link', { name: 'Модерация' })).toBeInTheDocument();
  });

  it('сначала показывает старые, по кнопке — новые', async () => {
    openQueue(moderator);
    const titles = async () =>
      (await screen.findAllByRole('heading', { level: 3 })).map(
        (h) => h.textContent,
      );
    expect(await titles()).toEqual(['Велосипед', 'Диван']);
    expect(
      screen.getByRole('button', { name: 'Сначала старые' }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Сначала новые' }));
    expect(await titles()).toEqual(['Диван', 'Велосипед']);
  });

  const patchBody = (fetchMock: ReturnType<typeof mockApi>) => {
    const call = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH');
    return call?.[1]?.body;
  };

  const queueLeft = () =>
    vi.waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Велосипед' })).toBeNull(),
    );

  it('публикует: решение уходит на сервер, объявление пропадает', async () => {
    const fetchMock = openQueue(moderator, {
      'PATCH /ads/1/status': [200, { ...bike, status: 'PUBLISHED' }],
    });
    const item = within(await itemOf('Велосипед'));
    fireEvent.click(item.getByRole('button', { name: 'Опубликовать' }));

    await screen.findByRole('heading', { name: 'Диван' });
    await queueLeft();
    expect(patchBody(fetchMock)).toBe(JSON.stringify({ status: 'PUBLISHED' }));
  });

  it('отклоняет с причиной из готовых', async () => {
    const fetchMock = openQueue(moderator, {
      'PATCH /ads/1/status': [200, { ...bike, status: 'REJECTED' }],
    });
    const item = within(await itemOf('Велосипед'));
    fireEvent.click(item.getByRole('button', { name: 'Отклонить' }));
    const form = within(
      screen.getByRole('form', { name: 'Отклонить «Велосипед»' }),
    );
    fireEvent.click(form.getByRole('button', { name: 'Нет фото товара' }));
    expect(form.getByLabelText('Причина для автора')).toHaveValue(
      'Нет фото товара',
    );
    fireEvent.click(form.getByRole('button', { name: 'Отклонить' }));

    await queueLeft();
    expect(patchBody(fetchMock)).toBe(
      JSON.stringify({ status: 'REJECTED', reason: 'Нет фото товара' }),
    );
  });

  it('отклоняет со своей причиной без лишних пробелов', async () => {
    const fetchMock = openQueue(moderator, {
      'PATCH /ads/1/status': [200, { ...bike, status: 'REJECTED' }],
    });
    const item = within(await itemOf('Велосипед'));
    fireEvent.click(item.getByRole('button', { name: 'Отклонить' }));
    fireEvent.change(screen.getByLabelText('Причина для автора'), {
      target: { value: '  Цена не совпадает с описанием ' },
    });
    fireEvent.click(
      within(screen.getByRole('form')).getByRole('button', {
        name: 'Отклонить',
      }),
    );

    await queueLeft();
    expect(patchBody(fetchMock)).toBe(
      JSON.stringify({
        status: 'REJECTED',
        reason: 'Цена не совпадает с описанием',
      }),
    );
  });

  it('без причины не отклоняет', async () => {
    const fetchMock = openQueue(moderator);
    const item = within(await itemOf('Велосипед'));
    fireEvent.click(item.getByRole('button', { name: 'Отклонить' }));
    fireEvent.change(screen.getByLabelText('Причина для автора'), {
      target: { value: '   ' },
    });
    fireEvent.click(
      within(screen.getByRole('form')).getByRole('button', {
        name: 'Отклонить',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Укажите причину отклонения',
    );
    expect(patchBody(fetchMock)).toBeUndefined();
  });

  it('отмена возвращает кнопки решения', async () => {
    openQueue(moderator);
    const item = within(await itemOf('Велосипед'));
    fireEvent.click(item.getByRole('button', { name: 'Отклонить' }));
    fireEvent.click(item.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('form')).toBeNull();
    expect(
      item.getByRole('button', { name: 'Опубликовать' }),
    ).toBeInTheDocument();
  });

  it('после последнего решения сообщает, что всё проверено', async () => {
    openQueue(moderator, {
      'GET /ads/moderation': [200, [bike]],
      'PATCH /ads/1/status': [200, bike],
    });
    const item = within(await itemOf('Велосипед'));
    fireEvent.click(item.getByRole('button', { name: 'Опубликовать' }));
    expect(
      await screen.findByText('Всё проверено, новых объявлений нет.'),
    ).toBeInTheDocument();
  });

  it('при ошибке оставляет объявление в очереди', async () => {
    openQueue(moderator, {
      'PATCH /ads/1/status': [404, { message: 'Объявление не найдено' }],
    });
    const item = within(await itemOf('Велосипед'));
    fireEvent.click(item.getByRole('button', { name: 'Отклонить' }));
    fireEvent.click(item.getByRole('button', { name: 'Не та рубрика' }));
    fireEvent.click(
      within(screen.getByRole('form')).getByRole('button', {
        name: 'Отклонить',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Объявление не найдено',
    );
    expect(
      screen.getByRole('heading', { name: 'Велосипед' }),
    ).toBeInTheDocument();
  });

  it('показывает ошибку загрузки очереди', async () => {
    openQueue(moderator, {
      'GET /ads/moderation': [500, { message: 'Ошибка сервера' }],
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ошибка сервера',
    );
  });
});
