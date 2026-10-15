import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const moderator = {
  id: 1,
  email: 'moderator@board.local',
  name: 'Модератор',
  role: 'MODERATOR',
};
const books = { id: 1, name: 'Книги', description: 'Учебники' };

function openAs(user: object, routes = {}) {
  localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = '#/categories';
  const fetchMock = mockApi({ 'GET /auth/me': [200, user], ...routes });
  render(<App />);
  return fetchMock;
}

describe('категории', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('главная показывает категории гостю', async () => {
    window.location.hash = '#/';
    mockApi({ 'GET /categories': [200, [books]] });
    render(<App />);
    expect(await screen.findByText('Книги')).toBeInTheDocument();
  });

  it('главная сообщает, если сервер недоступен', async () => {
    window.location.hash = '#/';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError()));
    render(<App />);
    expect(await screen.findByText(/Сервер недоступен/)).toBeInTheDocument();
  });

  it('гостя отправляет на страницу входа', () => {
    window.location.hash = '#/categories';
    mockApi({});
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
  });

  it('обычному пользователю раздел недоступен', async () => {
    openAs({ ...moderator, role: 'USER' });
    expect(
      await screen.findByText('Раздел доступен только модераторам.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Категории' })).toBeNull();
  });

  it('модератор добавляет категорию', async () => {
    const fetchMock = openAs(moderator, {
      'POST /categories': [201, books],
    });
    expect(
      await screen.findByRole('link', { name: 'Категории' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Категорий пока нет.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Книги' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/categories',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer tok',
          },
          body: JSON.stringify({ name: 'Книги', description: '' }),
        },
      ),
    );
  });

  it('показывает ошибку сервера при добавлении', async () => {
    openAs(moderator, {
      'POST /categories': [
        409,
        { message: 'Категория с таким названием уже есть' },
      ],
    });
    fireEvent.change(await screen.findByLabelText('Название'), {
      target: { value: 'Книги' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Категория с таким названием уже есть',
    );
  });

  it('модератор переименовывает категорию', async () => {
    const fetchMock = openAs(moderator, {
      'GET /categories': [200, [books]],
      'PATCH /categories/1': [200, books],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Изменить Книги' }),
    );
    const item = screen.getByRole('button', {
      name: 'Сохранить',
    }).parentElement!;
    fireEvent.change(within(item).getByLabelText('Название'), {
      target: { value: 'Литература' },
    });
    fireEvent.click(within(item).getByRole('button', { name: 'Сохранить' }));

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/categories/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Литература', description: 'Учебники' }),
        }),
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Изменить Книги' }),
    ).toBeInTheDocument();
  });

  it('отмена редактирования возвращает список', async () => {
    openAs(moderator, { 'GET /categories': [200, [books]] });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Изменить Книги' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(
      screen.getByRole('button', { name: 'Изменить Книги' }),
    ).toBeInTheDocument();
  });

  it('модератор удаляет категорию после подтверждения', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = openAs(moderator, {
      'GET /categories': [200, [books]],
      'DELETE /categories/1': [204, null],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Удалить Книги' }),
    );

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/categories/1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('не удаляет без подтверждения и показывает ошибку удаления', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = openAs(moderator, {
      'GET /categories': [200, [books]],
      'DELETE /categories/1': [404, { message: 'Категория не найдена' }],
    });
    const button = await screen.findByRole('button', { name: 'Удалить Книги' });
    fireEvent.click(button);
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://localhost:3000/categories/1',
      expect.anything(),
    );

    confirm.mockReturnValue(true);
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Категория не найдена',
    );
  });
});
