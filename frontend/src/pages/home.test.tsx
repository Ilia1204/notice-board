import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const categories = [
  { id: 1, name: 'Электроника', description: null },
  { id: 3, name: 'Транспорт', description: null },
];
const ad = (id: number, title: string, price: number | null, photo = '') => ({
  id,
  title,
  description: 'Описание объявления',
  price,
  status: 'PUBLISHED',
  category: { id: 3, name: 'Транспорт' },
  author: { id: 2, name: 'Анна' },
  images: photo ? [{ id: 1, filename: photo }] : [],
  createdAt: '2026-11-02T10:00:00.000Z',
});
const bike = ad(1, 'Велосипед Stels', 12500, 'bike.jpg');
const service = ad(2, 'Ремонт стиральных машин', null);

function openHome(routes = {}) {
  window.location.hash = '#/';
  const fetchMock = mockApi({
    'GET /categories': [200, categories],
    'GET /ads': [200, [bike, service]],
    ...routes,
  });
  render(<App />);
  return fetchMock;
}

const requested = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.map(([url]) => url.replace('http://localhost:3000', ''));

describe('список объявлений', () => {
  beforeEach(() => localStorage.clear());

  it('гость видит карточки с фото, ценой, рубрикой и датой', async () => {
    openHome();
    const list = await screen.findByRole('list', { name: 'Объявления' });
    const cards = within(list).getAllByRole('link');
    expect(cards).toHaveLength(2);

    expect(
      within(cards[0]).getByRole('img', { name: 'Велосипед Stels' }),
    ).toHaveAttribute('src', 'http://localhost:3000/uploads/bike.jpg');
    expect(cards[0]).toHaveTextContent(/12\s500 ₽/);
    expect(cards[0]).toHaveTextContent('Транспорт · 2 ноября');
    expect(cards[1]).toHaveTextContent('Договорная');
    expect(cards[0]).toHaveAttribute('href', '#/ads/1');
  });

  it('фильтрует по рубрике', async () => {
    const fetchMock = openHome({ 'GET /ads?categoryId=3': [200, [bike]] });
    await screen.findByText('Ремонт стиральных машин');

    fireEvent.click(screen.getByRole('button', { name: 'Транспорт' }));
    await screen.findByText('Велосипед Stels');
    expect(screen.queryByText('Ремонт стиральных машин')).toBeNull();
    expect(screen.getByRole('button', { name: 'Транспорт' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(requested(fetchMock)).toContain('/ads?categoryId=3');
  });

  it('ищет по названию и сообщает, если ничего не нашлось', async () => {
    const search = `/ads?${new URLSearchParams({ q: 'диван' })}`;
    const fetchMock = openHome({ [`GET ${search}`]: [200, []] });
    await screen.findByText('Велосипед Stels');

    fireEvent.change(screen.getByRole('searchbox', { name: /Поиск/ }), {
      target: { value: ' диван ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));

    expect(await screen.findByText(/Ничего не нашлось/)).toBeInTheDocument();
    expect(requested(fetchMock)).toContain(search);
  });

  it('без объявлений показывает заглушку', async () => {
    openHome({ 'GET /ads': [200, []] });
    expect(
      await screen.findByText(/Скоро здесь появятся объявления/),
    ).toBeInTheDocument();
  });

  it('показывает ошибку, если сервер недоступен', async () => {
    openHome({ 'GET /ads': [500, { message: 'Ошибка сервера' }] });
    expect(await screen.findByText('Ошибка сервера')).toBeInTheDocument();
  });
});
