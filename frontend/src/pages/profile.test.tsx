import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const user = { id: 2, email: 'ivan@mail.ru', name: 'Иван', role: 'USER' };
const profile = { ...user, createdAt: '2026-11-01T10:00:00.000Z' };
const bike = {
  id: 1,
  title: 'Велосипед',
  description: 'Горный, 21 скорость',
  price: 15000,
  status: 'PENDING',
  category: { id: 3, name: 'Транспорт' },
  author: { id: 2, name: 'Иван' },
  images: [],
  createdAt: '2026-11-01T10:00:00.000Z',
};

function open(routes = {}) {
  localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = '#/profile';
  const fetchMock = mockApi({
    'GET /auth/me': [200, user],
    'GET /users/me': [200, profile],
    'GET /ads/mine': [200, [bike]],
    ...routes,
  });
  render(<App />);
  return fetchMock;
}

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

describe('профиль', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('гостя отправляет на страницу входа', async () => {
    window.location.hash = '#/profile';
    mockApi({});
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Вход' }),
    ).toBeInTheDocument();
  });

  it('имя в шапке ведёт в профиль', async () => {
    localStorage.setItem('notice-board.token', 'tok');
    window.location.hash = '#/';
    mockApi({ 'GET /auth/me': [200, user] });
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Иван' })).toHaveAttribute(
      'href',
      '#/profile',
    );
  });

  it('показывает данные, дату регистрации и свои объявления', async () => {
    open();
    expect(await screen.findByLabelText('Имя')).toHaveValue('Иван');
    expect(screen.getByLabelText('Email')).toHaveValue('ivan@mail.ru');
    expect(screen.getByText(/На сайте с 1 ноября 2026/)).toBeInTheDocument();

    const list = await screen.findByRole('list', { name: 'Мои объявления' });
    expect(within(list).getByText('Велосипед')).toBeInTheDocument();
    expect(within(list).getByText('На проверке')).toBeInTheDocument();
  });

  it('сохраняет изменения и обновляет имя в шапке', async () => {
    const changed = { ...profile, name: 'Иван Петров', email: 'new@mail.ru' };
    const fetchMock = open({ 'PATCH /users/me': [200, changed] });
    await screen.findByLabelText('Имя');

    fill('Имя', 'Иван Петров');
    fill('Email', 'new@mail.ru');
    save();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Изменения сохранены',
    );
    expect(
      screen.getByRole('link', { name: 'Иван Петров' }),
    ).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(JSON.parse(call?.[1]?.body as string)).toEqual({
      name: 'Иван Петров',
      email: 'new@mail.ru',
    });
  });

  it('показывает ошибку, если email занят, и не меняет шапку', async () => {
    open({
      'PATCH /users/me': [
        409,
        { message: 'Пользователь с таким email уже существует' },
      ],
    });
    await screen.findByLabelText('Имя');

    fill('Имя', 'Пётр');
    save();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Пользователь с таким email уже существует',
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('link', { name: 'Иван' })).toBeInTheDocument();
  });

  it('показывает ошибку, если профиль не загрузился', async () => {
    open({ 'GET /users/me': [500, { message: 'Сервер недоступен' }] });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Сервер недоступен',
    );
    expect(screen.queryByRole('button', { name: 'Сохранить' })).toBeNull();
  });
});
