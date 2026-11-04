import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { mockApi } from '../test/mock-api';

const user = { id: 2, email: 'ivan@mail.ru', name: 'Иван', role: 'USER' };
const transport = { id: 3, name: 'Транспорт', description: null };
const furniture = { id: 4, name: 'Мебель', description: null };
const bike = {
  id: 1,
  title: 'Велосипед',
  description: 'Горный, 21 скорость',
  price: 15000,
  status: 'PUBLISHED',
  category: { id: 3, name: 'Транспорт' },
  author: { id: 2, name: 'Иван' },
  images: [
    { id: 11, filename: 'a.jpg' },
    { id: 12, filename: 'b.jpg' },
  ],
  createdAt: '2026-11-01T10:00:00.000Z',
};
const sofa = { ...bike, id: 2, title: 'Диван', status: 'PENDING', images: [] };
const closet = { ...bike, id: 3, title: 'Шкаф', status: 'REJECTED' };

function open(hash: string, routes = {}) {
  localStorage.setItem('notice-board.token', 'tok');
  window.location.hash = hash;
  const fetchMock = mockApi({
    'GET /auth/me': [200, user],
    'GET /categories': [200, [transport, furniture]],
    ...routes,
  });
  render(<App />);
  return fetchMock;
}

const sentForm = (fetchMock: ReturnType<typeof mockApi>) => {
  const call = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH');
  return call?.[1]?.body as FormData;
};

describe('мои объявления', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('гостя отправляет на страницу входа', () => {
    window.location.hash = '#/my-ads';
    mockApi({});
    render(<App />);
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  it('показывает статусы объявлений', async () => {
    open('#/my-ads', { 'GET /ads/mine': [200, [bike, sofa, closet]] });
    const list = await screen.findByRole('list', { name: 'Мои объявления' });
    expect(within(list).getByText('Опубликовано')).toBeInTheDocument();
    expect(within(list).getByText('На проверке')).toBeInTheDocument();
    expect(within(list).getByText('Отклонено')).toBeInTheDocument();
  });

  it('объявление не на сайте открывается для редактирования', async () => {
    open('#/my-ads', { 'GET /ads/mine': [200, [bike, sofa]] });
    expect(
      await screen.findByRole('link', { name: /15\s000 ₽ Велосипед/ }),
    ).toHaveAttribute('href', '#/ads/1');
    expect(
      screen.getByRole('link', { name: /15\s000 ₽ Диван/ }),
    ).toHaveAttribute('href', '#/ads/2/edit');
  });

  it('подсказывает подать объявление, если их нет', async () => {
    open('#/my-ads', { 'GET /ads/mine': [200, []] });
    expect(
      await screen.findByRole('link', { name: 'Подать первое объявление' }),
    ).toHaveAttribute('href', '#/ads/new');
  });

  it('удаляет объявление только после подтверждения', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const fetchMock = open('#/my-ads', {
      'GET /ads/mine': [200, [bike]],
      'DELETE /ads/1': [204, null],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Удалить Велосипед' }),
    );
    expect(confirm).toHaveBeenCalledWith('Удалить объявление «Велосипед»?');
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(
      false,
    );

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить Велосипед' }));
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(
        true,
      ),
    );
  });

  it('показывает ошибку удаления', async () => {
    vi.stubGlobal('confirm', () => true);
    open('#/my-ads', {
      'GET /ads/mine': [200, [bike]],
      'DELETE /ads/1': [404, { message: 'Объявление не найдено' }],
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Удалить Велосипед' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Объявление не найдено',
    );
  });
});

describe('редактирование объявления', () => {
  beforeEach(() => {
    localStorage.clear();
    // В jsdom нет превью файлов — подменяем
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:preview-${++n}`);
    URL.revokeObjectURL = vi.fn();
  });

  const openEdit = (routes = {}) =>
    open('#/ads/1/edit', {
      'GET /ads/mine/1': [200, bike],
      'PATCH /ads/1': [200, bike],
      'GET /ads/mine': [200, [bike]],
      ...routes,
    });

  it('заполняет форму данными объявления', async () => {
    openEdit();
    expect(await screen.findByLabelText('Заголовок')).toHaveValue('Велосипед');
    expect(screen.getByLabelText('Описание')).toHaveValue(bike.description);
    expect(screen.getByLabelText('Цена, ₽')).toHaveValue(15000);
    await screen.findByRole('option', { name: 'Транспорт' });
    expect(screen.getByLabelText('Категория')).toHaveValue('3');
    expect(screen.getByText('Выбрано: 2 из 10')).toBeInTheDocument();
    expect(screen.getByText(/снова пройдёт проверку/)).toBeInTheDocument();
  });

  it('сохраняет изменения и возвращает к моим объявлениям', async () => {
    const fetchMock = openEdit();
    await screen.findByRole('option', { name: 'Мебель' });
    fireEvent.change(screen.getByLabelText('Заголовок'), {
      target: { value: 'Самокат' },
    });
    fireEvent.change(screen.getByLabelText('Цена, ₽'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(
      await screen.findByRole('heading', { name: 'Мои объявления' }),
    ).toBeInTheDocument();
    const form = sentForm(fetchMock);
    expect(form.get('title')).toBe('Самокат');
    expect(form.get('categoryId')).toBe('3');
    expect(form.has('price')).toBe(false);
    expect(form.has('removeImageIds')).toBe(false);
  });

  it('убирает сохранённое фото и добавляет новое', async () => {
    const fetchMock = openEdit();
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Убрать сохранённое фото 1',
      }),
    );
    expect(screen.getByText('Выбрано: 1 из 10')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Фото/), {
      target: { files: [new File(['i'], 'c.png', { type: 'image/png' })] },
    });
    expect(screen.getByText('Выбрано: 2 из 10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await screen.findByRole('heading', { name: 'Мои объявления' });
    const form = sentForm(fetchMock);
    expect(form.getAll('removeImageIds')).toEqual(['11']);
    expect(form.getAll('images')).toHaveLength(1);
  });

  it('считает лимит вместе с сохранёнными фото', async () => {
    const fetchMock = openEdit();
    await screen.findByLabelText('Заголовок');
    const files = Array.from(
      { length: 9 },
      (_, i) => new File(['i'], `${i}.png`, { type: 'image/png' }),
    );
    fireEvent.change(screen.getByLabelText(/Фото/), { target: { files } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Можно прикрепить не больше 10 фото',
    );
    expect(sentForm(fetchMock)).toBeUndefined();
  });

  it('показывает ошибку сервера при сохранении', async () => {
    openEdit({ 'PATCH /ads/1': [400, { message: 'Такой категории нет' }] });
    await screen.findByRole('option', { name: 'Мебель' });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Такой категории нет',
    );
  });

  it('чужое объявление не открывается', async () => {
    openEdit({
      'GET /ads/mine/1': [
        403,
        { message: 'Можно менять только свои объявления' },
      ],
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Можно менять только свои объявления',
    );
    expect(screen.queryByRole('button', { name: 'Сохранить' })).toBeNull();
  });
});
