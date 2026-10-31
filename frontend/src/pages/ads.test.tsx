import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const user = { id: 2, email: 'ivan@mail.ru', name: 'Иван', role: 'USER' };
const transport = { id: 3, name: 'Транспорт', description: null };
const bike = {
  id: 1,
  title: 'Велосипед',
  description: 'Горный, 21 скорость',
  price: 15000,
  category: { id: 3, name: 'Транспорт' },
  author: { id: 2, name: 'Иван' },
  createdAt: '2026-11-01T10:00:00.000Z',
};

function openNewAd(routes = {}) {
  localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = '#/ads/new';
  const fetchMock = mockApi({
    'GET /auth/me': [200, user],
    'GET /categories': [200, [transport]],
    ...routes,
  });
  render(<App />);
  return fetchMock;
}

async function fillAd(price: string) {
  await screen.findByRole('option', { name: 'Транспорт' });
  const fields = {
    Заголовок: bike.title,
    Категория: '3',
    Описание: bike.description,
    'Цена, ₽': price,
  };
  for (const [label, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
}

const sentBody = (fetchMock: ReturnType<typeof mockApi>) => {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
  return JSON.parse(String(call?.[1]?.body)) as unknown;
};

describe('публикация объявления', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('гостя отправляет на страницу входа', () => {
    window.location.hash = '#/ads/new';
    mockApi({});
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
  });

  it('пользователь публикует объявление', async () => {
    const fetchMock = openNewAd({ 'POST /ads': [201, bike] });
    expect(
      await screen.findByRole('link', { name: 'Подать объявление' }),
    ).toBeInTheDocument();

    await fillAd('15000');

    expect(
      await screen.findByText(/«Велосипед» опубликовано в категории/),
    ).toBeInTheDocument();
    expect(sentBody(fetchMock)).toEqual({
      title: bike.title,
      description: bike.description,
      price: 15000,
      categoryId: 3,
    });
  });

  it('без цены отправляет объявление как договорное', async () => {
    const fetchMock = openNewAd({ 'POST /ads': [201, bike] });
    await fillAd('');
    await screen.findByText('Готово!');
    expect(sentBody(fetchMock)).not.toHaveProperty('price');
  });

  it('показывает ошибку сервера', async () => {
    openNewAd({ 'POST /ads': [400, { message: ['Такой категории нет'] }] });
    await fillAd('100');
    expect(await screen.findByText('Такой категории нет')).toBeInTheDocument();
  });
});
