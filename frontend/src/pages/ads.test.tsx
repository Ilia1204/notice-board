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
  status: 'PENDING',
  category: { id: 3, name: 'Транспорт' },
  author: { id: 2, name: 'Иван' },
  images: [{ id: 1, filename: 'bike.jpg' }],
  createdAt: '2026-11-01T10:00:00.000Z',
};
const photo = (type = 'image/jpeg', name = 'bike.jpg') =>
  new File(['img'], name, { type });

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

async function fillAd(price: string, files: File[] = []) {
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
  fireEvent.change(screen.getByLabelText(/Фото/), { target: { files } });
  fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
}

const sentForm = (fetchMock: ReturnType<typeof mockApi>) => {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
  return call?.[1]?.body as FormData;
};

describe('публикация объявления', () => {
  beforeEach(() => {
    localStorage.clear();
    // В jsdom нет превью файлов — подменяем
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('гостя отправляет на страницу входа', () => {
    window.location.hash = '#/ads/new';
    mockApi({});
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
  });

  it('пользователь публикует объявление с фото', async () => {
    const fetchMock = openNewAd({ 'POST /ads': [201, bike] });
    expect(
      await screen.findByRole('link', { name: 'Подать объявление' }),
    ).toBeInTheDocument();

    await fillAd('15000', [photo()]);

    expect(
      await screen.findByText(/«Велосипед» в категории «Транспорт»/),
    ).toBeInTheDocument();
    expect(screen.getByText(/отправлено на модерацию/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Велосипед' })).toHaveAttribute(
      'src',
      'http://localhost:3000/uploads/bike.jpg',
    );

    const form = sentForm(fetchMock);
    expect(form.get('title')).toBe(bike.title);
    expect(form.get('categoryId')).toBe('3');
    expect(form.get('price')).toBe('15000');
    expect(form.getAll('images')).toHaveLength(1);
  });

  it('показывает превью выбранных фото', async () => {
    openNewAd();
    await screen.findByRole('option', { name: 'Транспорт' });
    fireEvent.change(screen.getByLabelText(/Фото/), {
      target: { files: [photo(), photo()] },
    });
    expect(screen.getAllByRole('img', { name: /Фото \d/ })).toHaveLength(2);
  });

  it('без цены и фото отправляет объявление как договорное', async () => {
    const fetchMock = openNewAd({
      'POST /ads': [201, { ...bike, images: [] }],
    });
    await fillAd('');
    await screen.findByText('Готово!');
    const form = sentForm(fetchMock);
    expect(form.has('price')).toBe(false);
    expect(form.has('images')).toBe(false);
  });

  it('не отправляет файлы другого формата', async () => {
    const fetchMock = openNewAd();
    await fillAd('100', [photo('application/pdf', 'doc.pdf')]);
    expect(
      screen.getByText('Фото должны быть в формате JPG, PNG или WEBP'),
    ).toBeInTheDocument();
    expect(sentForm(fetchMock)).toBeUndefined();
  });

  it('не отправляет больше 5 фото', async () => {
    openNewAd();
    await fillAd(
      '100',
      Array.from({ length: 6 }, () => photo()),
    );
    expect(
      screen.getByText('Можно прикрепить не больше 5 фото'),
    ).toBeInTheDocument();
  });

  it('показывает ошибку сервера', async () => {
    openNewAd({ 'POST /ads': [400, { message: ['Такой категории нет'] }] });
    await fillAd('100');
    expect(await screen.findByText('Такой категории нет')).toBeInTheDocument();
  });
});
