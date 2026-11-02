import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const bike = {
  id: 1,
  title: 'Велосипед Stels',
  description: 'Горный, 21 скорость.\nПосле ТО.',
  price: 12500,
  status: 'PUBLISHED',
  category: { id: 3, name: 'Транспорт' },
  author: { id: 2, name: 'Анна' },
  images: [
    { id: 1, filename: 'a.jpg' },
    { id: 2, filename: 'b.jpg' },
  ],
  createdAt: '2026-11-02T10:00:00.000Z',
};

function openAd(routes = {}) {
  window.location.hash = '#/ads/1';
  mockApi({ 'GET /ads/1': [200, bike], ...routes });
  render(<App />);
}

describe('карточка объявления', () => {
  beforeEach(() => localStorage.clear());

  it('открывается по клику из списка', async () => {
    window.location.hash = '#/';
    mockApi({ 'GET /ads': [200, [bike]], 'GET /ads/1': [200, bike] });
    render(<App />);
    fireEvent.click(await screen.findByRole('link', { name: /Велосипед/ }));
    expect(
      await screen.findByRole('heading', { name: 'Велосипед Stels' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/ads/1');
  });

  it('показывает цену, рубрику, продавца, дату и описание с переносами', async () => {
    openAd();
    await screen.findByRole('heading', { name: 'Велосипед Stels' });
    expect(screen.getByText(/12\s500 ₽/)).toBeInTheDocument();
    expect(screen.getByText('Транспорт')).toBeInTheDocument();
    expect(screen.getByText('Анна')).toBeInTheDocument();
    expect(
      screen.getByText('Опубликовано 2 ноября 2026 г.'),
    ).toBeInTheDocument();
    const description = screen.getByText(/Горный, 21 скорость/);
    expect(description.textContent).toBe(bike.description);
    expect(description).toHaveClass('ad-page__description');
  });

  it('переключает фото', async () => {
    openAd();
    const photo = await screen.findByRole('img', { name: 'Велосипед Stels' });
    expect(photo).toHaveAttribute('src', 'http://localhost:3000/uploads/a.jpg');

    fireEvent.click(screen.getByRole('button', { name: 'Показать фото 2' }));
    expect(photo).toHaveAttribute('src', 'http://localhost:3000/uploads/b.jpg');
    expect(
      screen.getByRole('button', { name: 'Показать фото 2' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('без цены пишет «Договорная», без фото — заглушка', async () => {
    openAd({ 'GET /ads/1': [200, { ...bike, price: null, images: [] }] });
    expect(await screen.findByText('Договорная')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button', { name: /Показать фото/ })).toBeNull();
  });

  it('сообщает, если объявления нет', async () => {
    openAd({ 'GET /ads/1': [404, { message: 'Объявление не найдено' }] });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Объявление не найдено',
    );
    expect(
      screen.getByRole('link', { name: /Все объявления/ }),
    ).toHaveAttribute('href', '#/');
  });
});
