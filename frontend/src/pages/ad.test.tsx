import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('кнопки автора', () => {
    const asUser = (id: number) => {
      localStorage.setItem('notice-board.token', 'tok');
      return {
        'GET /auth/me': [
          200,
          { id, email: 'a@b.c', name: 'Анна', role: 'USER' },
        ],
      };
    };

    afterEach(() => vi.unstubAllGlobals());

    it('гость и чужой пользователь кнопок не видят', async () => {
      openAd();
      await screen.findByRole('heading', { name: 'Велосипед Stels' });
      expect(screen.queryByRole('button', { name: 'Удалить' })).toBeNull();
      cleanup();

      openAd(asUser(9));
      await screen.findByRole('button', { name: 'Выйти' });
      expect(screen.queryByRole('link', { name: 'Изменить' })).toBeNull();
    });

    it('автор переходит к редактированию', async () => {
      openAd(asUser(2));
      expect(
        await screen.findByRole('link', { name: 'Изменить' }),
      ).toHaveAttribute('href', '#/ads/1/edit');
    });

    it('автор удаляет объявление после подтверждения', async () => {
      vi.stubGlobal('confirm', () => true);
      openAd({ ...asUser(2), 'DELETE /ads/1': [204, null] });
      fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
      expect(
        await screen.findByRole('heading', { name: 'Мои объявления' }),
      ).toBeInTheDocument();
    });

    it('показывает ошибку удаления на карточке', async () => {
      vi.stubGlobal('confirm', () => true);
      openAd({
        ...asUser(2),
        'DELETE /ads/1': [403, { message: 'Нельзя' }],
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Нельзя');
      expect(screen.getByText('Велосипед Stels')).toBeInTheDocument();
    });
  });
});
