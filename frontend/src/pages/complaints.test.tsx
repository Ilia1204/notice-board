import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const buyer = { id: 5, email: 'ivan@mail.ru', name: 'Иван', role: 'USER' };
const moderator = { ...buyer, id: 1, name: 'Модератор', role: 'MODERATOR' };
const bike = {
  id: 1,
  title: 'Велосипед Stels',
  description: 'Горный',
  price: 12500,
  status: 'PUBLISHED',
  category: { id: 3, name: 'Транспорт' },
  author: { id: 2, name: 'Анна' },
  images: [],
  createdAt: '2026-11-02T10:00:00.000Z',
};

function open(hash: string, user: object | null, routes = {}) {
  if (user) localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = hash;
  const fetchMock = mockApi({
    'GET /auth/me': [200, user],
    'GET /ads/1': [200, bike],
    ...routes,
  });
  render(<App />);
  return fetchMock;
}

const sentBody = (fetchMock: ReturnType<typeof mockApi>, method: string) =>
  JSON.parse(
    String(
      fetchMock.mock.calls.find(([, i]) => i?.method === method)?.[1]?.body,
    ),
  ) as unknown;

describe('жалоба на карточке объявления', () => {
  beforeEach(() => localStorage.clear());

  it('гостю не показывается', async () => {
    open('#/ads/1', null);
    await screen.findByRole('heading', { name: 'Велосипед Stels' });
    expect(screen.queryByRole('button', { name: /Пожаловаться/ })).toBeNull();
  });

  it('автору своего объявления не показывается', async () => {
    open('#/ads/1', { ...buyer, id: 2 });
    await screen.findByRole('link', { name: 'Изменить' });
    expect(screen.queryByRole('button', { name: /Пожаловаться/ })).toBeNull();
  });

  it('жалоба на объявление уходит с причиной и комментарием', async () => {
    const fetchMock = open('#/ads/1', buyer, {
      'POST /complaints': [201, { id: 1 }],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Пожаловаться на объявление' }),
    );
    const form = within(
      screen.getByRole('form', { name: 'Жалоба на объявление' }),
    );
    fireEvent.click(form.getByRole('radio', { name: 'Мошенничество' }));
    fireEvent.change(form.getByRole('textbox'), {
      target: { value: 'Просит предоплату' },
    });
    fireEvent.click(form.getByRole('button', { name: 'Отправить жалобу' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Жалоба отправлена. Модератор её рассмотрит.',
    );
    expect(screen.queryByRole('form')).toBeNull();
    expect(sentBody(fetchMock, 'POST')).toEqual({
      adId: 1,
      reason: 'FRAUD',
      comment: 'Просит предоплату',
    });
  });

  it('жалоба на продавца уходит на автора объявления', async () => {
    const fetchMock = open('#/ads/1', buyer, {
      'POST /complaints': [201, { id: 1 }],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'на продавца' }));
    const form = within(
      screen.getByRole('form', { name: 'Жалоба на продавца' }),
    );
    fireEvent.click(form.getByRole('button', { name: 'Отправить жалобу' }));
    await screen.findByRole('status');
    expect(sentBody(fetchMock, 'POST')).toEqual({
      userId: 2,
      reason: 'SPAM',
      comment: '',
    });
  });

  it('показывает ошибку сервера и оставляет форму открытой', async () => {
    open('#/ads/1', buyer, {
      'POST /complaints': [
        409,
        { message: 'Вы уже пожаловались, жалоба на рассмотрении' },
      ],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Пожаловаться на объявление' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Отправить жалобу' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Вы уже пожаловались',
    );
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  it('«Отмена» закрывает форму', async () => {
    open('#/ads/1', buyer);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Пожаловаться на объявление' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('form')).toBeNull();
  });
});

describe('жалобы у модератора', () => {
  beforeEach(() => localStorage.clear());

  const adComplaint = {
    id: 1,
    reason: 'FRAUD',
    comment: 'Просит предоплату',
    createdAt: '2026-11-10T09:30:00.000Z',
    reporter: { id: 5, name: 'Иван' },
    ad: {
      id: 1,
      title: 'Велосипед Stels',
      status: 'PUBLISHED',
      author: { id: 2, name: 'Анна' },
    },
    user: null,
  };
  const sameAd = {
    ...adComplaint,
    id: 2,
    reason: 'SPAM',
    comment: null,
    reporter: { id: 6, name: 'Пётр' },
  };
  const userComplaint = {
    ...adComplaint,
    id: 3,
    reason: 'OFFENSIVE',
    comment: null,
    ad: null,
    user: { id: 7, name: 'Олег' },
  };
  const all = [adComplaint, sameAd, userComplaint];

  const items = () =>
    within(screen.getByRole('list', { name: 'Жалобы на рассмотрении' }))
      .getAllByRole('listitem')
      .filter((li) => li.classList.contains('moderation__item'));

  it('обычному пользователю недоступны', async () => {
    open('#/complaints', buyer);
    expect(
      await screen.findByText('Раздел доступен только модераторам.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Жалобы' })).toBeNull();
  });

  it('показывает цель, причину, комментарий и автора жалобы', async () => {
    open('#/complaints', moderator, { 'GET /complaints': [200, all] });
    await screen.findByText('Просит предоплату');
    const first = within(items()[0]);
    expect(
      first.getByRole('link', { name: '«Велосипед Stels»' }),
    ).toHaveAttribute('href', '#/ads/1');
    expect(first.getByText('продавца Анна')).toBeInTheDocument();
    expect(first.getByText('Мошенничество')).toBeInTheDocument();
    expect(first.getByText('Просит предоплату')).toBeInTheDocument();
    expect(first.getByText(/Пожаловался Иван/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Пользователь Олег' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Жалобы' })).toBeInTheDocument();
  });

  it('скрытие объявления убирает все жалобы на него', async () => {
    const fetchMock = open('#/complaints', moderator, {
      'GET /complaints': [200, all],
      'PATCH /complaints/1': [204, null],
    });
    await screen.findByText('Просит предоплату');
    fireEvent.click(
      within(items()[0]).getByRole('button', { name: 'Скрыть объявление' }),
    );
    await vi.waitFor(() => expect(items()).toHaveLength(1));
    expect(
      screen.getByRole('heading', { name: 'Пользователь Олег' }),
    ).toBeInTheDocument();
    expect(sentBody(fetchMock, 'PATCH')).toEqual({ status: 'ACCEPTED' });
  });

  it('отклонение убирает только эту жалобу', async () => {
    const fetchMock = open('#/complaints', moderator, {
      'GET /complaints': [200, all],
      'PATCH /complaints/1': [204, null],
    });
    await screen.findByText('Просит предоплату');
    fireEvent.click(
      within(items()[0]).getByRole('button', { name: 'Отклонить жалобу' }),
    );
    await vi.waitFor(() => expect(items()).toHaveLength(2));
    expect(screen.queryByText('Просит предоплату')).toBeNull();
    expect(sentBody(fetchMock, 'PATCH')).toEqual({ status: 'DISMISSED' });
  });

  it('для жалобы на пользователя предлагает скрыть все его объявления', async () => {
    open('#/complaints', moderator, {
      'GET /complaints': [200, [userComplaint]],
      'PATCH /complaints/3': [204, null],
    });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Скрыть все объявления пользователя',
      }),
    );
    expect(await screen.findByText('Новых жалоб нет.')).toBeInTheDocument();
  });

  it('скрытое объявление показывает без ссылки', async () => {
    open('#/complaints', moderator, {
      'GET /complaints': [
        200,
        [{ ...adComplaint, ad: { ...adComplaint.ad, status: 'REJECTED' } }],
      ],
    });
    expect(
      await screen.findByRole('heading', { name: /«Велосипед Stels»/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '«Велосипед Stels»' }),
    ).toBeNull();
  });

  it('при ошибке оставляет жалобу в списке', async () => {
    open('#/complaints', moderator, {
      'GET /complaints': [200, [adComplaint]],
      'PATCH /complaints/1': [409, { message: 'Жалоба уже рассмотрена' }],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Отклонить жалобу' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Жалоба уже рассмотрена',
    );
    expect(items()).toHaveLength(1);
  });
});
