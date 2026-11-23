import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { serverEmit } from '../test/fake-socket';
import { mockApi } from '../test/mock-api';

const user = { id: 2, email: 'ivan@mail.ru', name: 'Иван', role: 'USER' };
const rejected = {
  id: 3,
  title: 'Шкаф',
  status: 'REJECTED',
  rejectReason: 'Нет фото товара',
};

// Полное объявление автора — для страницы правки
const ad = {
  description: 'Икеа, две двери',
  price: 3000,
  category: { id: 4, name: 'Мебель' },
  author: { id: 2, name: 'Иван' },
  images: [],
  createdAt: '2026-11-01T10:00:00.000Z',
};

function openHome(routes = {}) {
  localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = '#/';
  mockApi({ 'GET /auth/me': [200, user], ...routes });
  render(<App />);
}

describe('уведомление о решении модератора', () => {
  beforeEach(() => localStorage.clear());

  it('сообщает об отказе с причиной и ведёт к правке', async () => {
    openHome({ 'GET /ads/mine/3': [200, { ...ad, ...rejected }] });
    await screen.findByRole('button', { name: 'Выйти' });
    act(() => serverEmit('ad:moderated', rejected));

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Объявление «Шкаф» отклонено');
    expect(notice).toHaveTextContent('Причина: Нет фото товара');
    fireEvent.click(screen.getByRole('link', { name: 'Исправить' }));
    expect(
      await screen.findByText(
        'Модератор отклонил объявление. Причина: Нет фото товара',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('сообщает о публикации и даёт открыть объявление', async () => {
    openHome();
    await screen.findByRole('button', { name: 'Выйти' });
    act(() =>
      serverEmit('ad:moderated', {
        ...rejected,
        status: 'PUBLISHED',
        rejectReason: null,
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Объявление «Шкаф» опубликовано',
    );
    expect(screen.getByRole('link', { name: 'Открыть' })).toHaveAttribute(
      'href',
      '#/ads/3',
    );
  });

  it('новое решение по тому же объявлению заменяет прежнее, крестик закрывает', async () => {
    openHome();
    await screen.findByRole('button', { name: 'Выйти' });
    act(() => serverEmit('ad:moderated', rejected));
    act(() =>
      serverEmit('ad:moderated', {
        ...rejected,
        rejectReason: 'Не та рубрика',
      }),
    );
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Причина: Не та рубрика');

    fireEvent.click(
      screen.getByRole('button', { name: 'Закрыть уведомление' }),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
