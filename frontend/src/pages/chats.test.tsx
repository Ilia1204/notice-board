import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { formatSentAt } from '../api/chats';
import { fakeSocket, io, serverEmit } from '../test/fake-socket';
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
const question = {
  id: 10,
  chatId: 7,
  senderId: 2,
  text: 'Ещё продаёте?',
  createdAt: '2026-11-06T10:00:00.000Z',
};
const answer = { ...question, id: 11, senderId: 5, text: 'Да, продаю' };
const chat = {
  id: 7,
  ad: { id: 1, title: 'Велосипед' },
  companion: { id: 5, name: 'Анна' },
  lastMessage: answer,
  updatedAt: answer.createdAt,
};

function open(hash: string, routes = {}) {
  localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = hash;
  const fetchMock = mockApi({ 'GET /auth/me': [200, user], ...routes });
  render(<App />);
  return fetchMock;
}

const posted = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => [
      url.replace('http://localhost:3000', ''),
      JSON.parse(String(init?.body)) as unknown,
    ]);

describe('сообщения', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('гость видит кнопку, но она ведёт на вход', async () => {
    window.location.hash = '#/ads/1';
    mockApi({ 'GET /ads/1': [200, bike] });
    render(<App />);
    const link = await screen.findByRole('link', {
      name: 'Написать продавцу',
    });
    expect(link).toHaveAttribute('href', '#/login');
    expect(screen.queryByRole('link', { name: 'Сообщения' })).toBeNull();
  });

  it('автор не пишет сам себе', async () => {
    open('#/ads/1', { 'GET /ads/1': [200, { ...bike, author: user }] });
    await screen.findByRole('button', { name: 'Удалить' });
    expect(screen.queryByText('Написать продавцу')).toBeNull();
  });

  it('кнопка на объявлении открывает диалог с продавцом', async () => {
    const fetchMock = open('#/ads/1', {
      'GET /ads/1': [200, bike],
      'POST /chats': [201, { ...chat, lastMessage: null }],
      'GET /chats/7': [200, { ...chat, lastMessage: null }],
      'GET /chats/7/messages': [200, []],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Написать продавцу' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Анна' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Напишите первое сообщение')).toBeInTheDocument();
    expect(posted(fetchMock)).toEqual([['/chats', { adId: 1 }]]);
  });

  it('список показывает собеседника, объявление и последнее сообщение', async () => {
    open('#/chats', {
      'GET /chats': [200, [chat, { ...chat, id: 8, lastMessage: question }]],
    });
    const list = await screen.findByRole('list', { name: 'Диалоги' });
    const [first, second] = within(list).getAllByRole('link');
    expect(first).toHaveAttribute('href', '#/chats/7');
    expect(first).toHaveTextContent('Анна');
    expect(first).toHaveTextContent('Велосипед');
    expect(first).toHaveTextContent('Да, продаю');
    expect(second).toHaveTextContent('Вы: Ещё продаёте?');
  });

  it('без диалогов показывает подсказку', async () => {
    open('#/chats', { 'GET /chats': [200, []] });
    expect(await screen.findByText(/Диалогов пока нет/)).toBeInTheDocument();
  });

  it('показывает историю: свои сообщения отдельно от чужих', async () => {
    open('#/chats/7', {
      'GET /chats/7': [200, chat],
      'GET /chats/7/messages': [200, [question, answer]],
    });
    const list = await screen.findByRole('list', { name: 'Сообщения' });
    await within(list).findByText('Да, продаю');
    expect(within(list).getByText('Ещё продаёте?').parentElement).toHaveClass(
      'bubble--mine',
    );
    expect(within(list).getByText('Да, продаю').parentElement).not.toHaveClass(
      'bubble--mine',
    );
    expect(screen.getByRole('link', { name: 'Велосипед' })).toHaveAttribute(
      'href',
      '#/ads/1',
    );
  });

  it('отправляет сообщение по Enter и очищает поле', async () => {
    const fetchMock = open('#/chats/7', {
      'GET /chats/7': [200, chat],
      'GET /chats/7/messages': [200, [question]],
      'POST /chats/7/messages': [201, answer],
    });
    const field = await screen.findByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: 'Да, продаю' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(posted(fetchMock)).toEqual([]);

    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByText('Да, продаю')).toBeInTheDocument();
    expect(field).toHaveValue('');
    expect(posted(fetchMock)).toEqual([
      ['/chats/7/messages', { text: 'Да, продаю' }],
    ]);
  });

  it('пустое сообщение не отправить', async () => {
    open('#/chats/7', {
      'GET /chats/7': [200, chat],
      'GET /chats/7/messages': [200, []],
    });
    const field = await screen.findByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
  });

  it('чужой диалог не открывается', async () => {
    open('#/chats/7', {
      'GET /chats/7': [403, { message: 'Это чужой диалог' }],
      'GET /chats/7/messages': [403, { message: 'Это чужой диалог' }],
    });
    expect(await screen.findByText('Это чужой диалог')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('время сегодняшних сообщений, дата — для более ранних', () => {
    const now = new Date('2026-11-07T15:00:00');
    expect(formatSentAt('2026-11-07T09:05:00', now)).toBe('09:05');
    expect(formatSentAt('2026-11-05T09:05:00', now)).toMatch(/^5 нояб/);
  });
});

describe('сообщения в реальном времени', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const dialog = () =>
    open('#/chats/7', {
      'GET /chats/7': [200, chat],
      'GET /chats/7/messages': [200, [question]],
    });
  const fromServer = (message: unknown) =>
    act(() => serverEmit('message:new', message));

  it('соединение открывается только после входа', async () => {
    window.location.hash = '#/';
    mockApi({});
    render(<App />);
    await screen.findByRole('link', { name: 'Войти' });
    expect(io).not.toHaveBeenCalled();

    dialog();
    await screen.findByText('Ещё продаёте?');
    expect(io).toHaveBeenCalledWith('http://localhost:3000', {
      auth: { token: 'tok' },
    });
  });

  it('ответ собеседника появляется без перезагрузки', async () => {
    dialog();
    await screen.findByText('Ещё продаёте?');
    fromServer(answer);
    fromServer({ ...answer, id: 12, chatId: 8, text: 'Из другого диалога' });
    expect(screen.getByText('Да, продаю')).toBeInTheDocument();
    expect(screen.queryByText('Из другого диалога')).toBeNull();
  });

  it('при соединении отправляет по WebSocket, без дублей', async () => {
    fakeSocket.connected = true;
    fakeSocket.emitWithAck.mockResolvedValue({ message: answer });
    const fetchMock = dialog();
    const field = await screen.findByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: 'Да, продаю' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByText('Да, продаю')).toBeInTheDocument();
    fromServer(answer);
    expect(screen.getAllByText('Да, продаю')).toHaveLength(1);
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith('message:send', {
      chatId: 7,
      text: 'Да, продаю',
    });
    expect(posted(fetchMock)).toEqual([]);
  });

  it('ошибку с сервера показывает пользователю', async () => {
    fakeSocket.connected = true;
    fakeSocket.emitWithAck.mockResolvedValue({ error: 'Это чужой диалог' });
    dialog();
    const field = await screen.findByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: 'Привет' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText('Это чужой диалог')).toBeInTheDocument();
    expect(field).toHaveValue('Привет');
  });

  it('если WebSocket не ответил, отправляет обычным запросом', async () => {
    fakeSocket.connected = true;
    fakeSocket.emitWithAck.mockRejectedValue(new Error('timeout'));
    const fetchMock = open('#/chats/7', {
      'GET /chats/7': [200, chat],
      'GET /chats/7/messages': [200, []],
      'POST /chats/7/messages': [201, answer],
    });
    const field = await screen.findByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(field, { target: { value: 'Да, продаю' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText('Да, продаю')).toBeInTheDocument();
    expect(posted(fetchMock)).toEqual([
      ['/chats/7/messages', { text: 'Да, продаю' }],
    ]);
  });

  it('список диалогов обновляется при новом сообщении', async () => {
    const fetchMock = open('#/chats', { 'GET /chats': [200, [chat]] });
    await screen.findByText('Да, продаю');
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            { ...chat, lastMessage: { ...answer, text: 'Жду' } },
          ]),
          { status: 200 },
        ),
      ),
    );
    fromServer({ ...answer, text: 'Жду' });
    expect(await screen.findByText('Жду')).toBeInTheDocument();
  });
});
