import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const user = { id: 1, email: 'ivan@mail.ru', name: 'Иван', role: 'USER' };

function fillAndSubmit(fields: Record<string, string>, button: string) {
  for (const [label, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: button }));
}

describe('вход и регистрация', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('гость видит ссылки входа и регистрации', () => {
    mockApi({});
    render(<App />);
    expect(screen.getByRole('link', { name: 'Войти' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Регистрация' }),
    ).toBeInTheDocument();
  });

  it('после входа показывает имя пользователя и сохраняет токен', async () => {
    mockApi({ 'POST /auth/login': [200, { accessToken: 'tok', user }] });
    window.location.hash = '#/login';
    render(<App />);

    fillAndSubmit({ Email: user.email, Пароль: 'secret12' }, 'Войти');

    expect(await screen.findByText('Иван')).toBeInTheDocument();
    expect(localStorage.getItem('notice-board.token')).toBe('tok');
    expect(window.location.hash).toBe('#/');
  });

  it('показывает ошибку при неверном пароле', async () => {
    mockApi({
      'POST /auth/login': [401, { message: 'Неверный email или пароль' }],
    });
    window.location.hash = '#/login';
    render(<App />);

    fillAndSubmit({ Email: user.email, Пароль: 'wrong' }, 'Войти');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Неверный email или пароль',
    );
  });

  it('регистрирует нового пользователя', async () => {
    const fetchMock = mockApi({
      'POST /auth/register': [201, { accessToken: 'tok', user }],
    });
    window.location.hash = '#/register';
    render(<App />);

    fillAndSubmit(
      { Имя: 'Иван', Email: user.email, Пароль: 'secret12' },
      'Зарегистрироваться',
    );

    expect(await screen.findByText('Иван')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/auth/register',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('восстанавливает вход по сохранённому токену и выходит', async () => {
    localStorage.setItem('notice-board.token', 'tok');
    mockApi({ 'GET /auth/me': [200, user] });
    render(<App />);

    expect(await screen.findByText('Иван')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(screen.getByRole('link', { name: 'Войти' })).toBeInTheDocument();
    expect(localStorage.getItem('notice-board.token')).toBeNull();
  });

  it('сбрасывает просроченный токен', async () => {
    localStorage.setItem('notice-board.token', 'old');
    mockApi({ 'GET /auth/me': [401, { message: 'Unauthorized' }] });
    render(<App />);

    await vi.waitFor(() =>
      expect(localStorage.getItem('notice-board.token')).toBeNull(),
    );
  });
});
