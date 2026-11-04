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
const sofa = { ...bike, id: 2, title: 'Диван', price: null, images: [] };

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
    expect(item.getByText('Транспорт · Иван')).toBeInTheDocument();
    expect(item.getByText(bike.description)).toBeInTheDocument();
    expect(
      item.getByRole('img', { name: 'Велосипед, фото 1' }),
    ).toHaveAttribute('src', 'http://localhost:3000/uploads/a.jpg');
    expect(screen.getByRole('link', { name: 'Модерация' })).toBeInTheDocument();
  });

  it.each([
    ['Опубликовать', 'PUBLISHED'],
    ['Отклонить', 'REJECTED'],
  ])(
    '%s: решение уходит на сервер, объявление пропадает',
    async (name, status) => {
      const fetchMock = openQueue(moderator, {
        'PATCH /ads/1/status': [200, { ...bike, status }],
      });
      const item = within(await itemOf('Велосипед'));
      fireEvent.click(item.getByRole('button', { name }));

      await screen.findByRole('heading', { name: 'Диван' });
      await vi.waitFor(() =>
        expect(screen.queryByRole('heading', { name: 'Велосипед' })).toBeNull(),
      );
      const call = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH');
      expect(call?.[1]?.body).toBe(JSON.stringify({ status }));
    },
  );

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
