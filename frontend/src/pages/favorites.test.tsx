import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const user = { id: 2, email: 'ivan@mail.ru', name: 'Иван', role: 'USER' };
const bike = {
  id: 1,
  title: 'Велосипед',
  description: 'Горный, 21 скорость',
  price: 15000,
  status: 'PUBLISHED',
  category: { id: 3, name: 'Транспорт' },
  author: { id: 5, name: 'Анна' },
  images: [],
  createdAt: '2026-11-01T10:00:00.000Z',
};
const sofa = { ...bike, id: 2, title: 'Диван' };

function open(hash: string, routes = {}) {
  localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = hash;
  const fetchMock = mockApi({
    'GET /auth/me': [200, user],
    'GET /ads': [200, [bike, sofa]],
    ...routes,
  });
  render(<App />);
  return fetchMock;
}

const sent = (fetchMock: ReturnType<typeof mockApi>, method: string) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url]) => url.replace('http://localhost:3000', ''));

describe('избранное', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('гость не видит сердечек и ссылки на избранное', async () => {
    window.location.hash = '#/';
    mockApi({ 'GET /ads': [200, [bike]] });
    render(<App />);
    await screen.findByRole('link', { name: /Велосипед/ });
    expect(screen.queryByRole('button', { name: /избранн/i })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Избранное' })).toBeNull();
  });

  it('гостя со страницы избранного отправляет на вход', async () => {
    window.location.hash = '#/favorites';
    mockApi({});
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Вход' }),
    ).toBeInTheDocument();
  });

  it('сердечко на карточке добавляет объявление', async () => {
    const fetchMock = open('#/', { 'PUT /favorites/1': [204, null] });
    fireEvent.click(
      await screen.findByRole('button', { name: 'В избранное: Велосипед' }),
    );

    const pressed = await screen.findByRole('button', {
      name: 'В избранном: Велосипед',
    });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    expect(sent(fetchMock, 'PUT')).toEqual(['/favorites/1']);
  });

  it('отмечает то, что уже лежит в избранном', async () => {
    open('#/', { 'GET /favorites': [200, [sofa]] });
    expect(
      await screen.findByRole('button', { name: 'В избранном: Диван' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'В избранное: Велосипед' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('показывает ошибку, если объявление уже сняли', async () => {
    open('#/', {
      'PUT /favorites/1': [404, { message: 'Объявление не найдено' }],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'В избранное: Велосипед' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Объявление не найдено',
    );
    expect(
      screen.getByRole('button', { name: 'В избранное: Велосипед' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('страница показывает избранное, снятая карточка исчезает', async () => {
    const fetchMock = open('#/favorites', {
      'GET /favorites': [200, [bike, sofa]],
      'DELETE /favorites/1': [204, null],
    });
    const list = await screen.findByRole('list', { name: 'Избранное' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(
      within(list).getByRole('button', { name: 'В избранном: Велосипед' }),
    );

    await waitFor(() =>
      expect(within(list).getAllByRole('listitem')).toHaveLength(1),
    );
    expect(within(list).getByText('Диван')).toBeInTheDocument();
    expect(sent(fetchMock, 'DELETE')).toEqual(['/favorites/1']);
  });

  it('пустое избранное ведёт к объявлениям', async () => {
    open('#/favorites');
    expect(await screen.findByText(/Здесь пока пусто/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Посмотреть объявления' }),
    ).toHaveAttribute('href', '#/');
  });

  it('на странице объявления кнопка с текстом переключается', async () => {
    const fetchMock = open('#/ads/1', {
      'GET /ads/1': [200, bike],
      'PUT /favorites/1': [204, null],
      'DELETE /favorites/1': [204, null],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'В избранное' }));
    fireEvent.click(await screen.findByRole('button', { name: 'В избранном' }));

    expect(
      await screen.findByRole('button', { name: 'В избранное' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(sent(fetchMock, 'PUT')).toEqual(['/favorites/1']);
    expect(sent(fetchMock, 'DELETE')).toEqual(['/favorites/1']);
  });

  it('после выхода сердечек больше нет', async () => {
    open('#/', { 'GET /favorites': [200, [bike]] });
    await screen.findByRole('button', { name: 'В избранном: Велосипед' });

    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /избранн/i })).toBeNull(),
    );
  });
});
