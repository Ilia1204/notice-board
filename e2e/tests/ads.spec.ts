import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { login, register, uniqueUser } from './helpers';

// Минимальная PNG-картинка 1×1
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Т2. Публикация объявления
test.describe('Т2. Публикация объявления', () => {
  test('гостя отправляет на страницу входа', async ({ page }) => {
    await page.goto('/#/ads/new');
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  });

  test('пользователь подаёт объявление с фото', async ({ page }) => {
    await register(page, uniqueUser());
    await page.getByRole('link', { name: 'Подать объявление' }).click();

    await page.getByLabel('Заголовок').fill('Велосипед Stels');
    await page.getByLabel('Категория').selectOption({ label: 'Транспорт' });
    await page.getByLabel('Описание').fill('Горный, 21 скорость, почти новый');
    await page.getByLabel('Цена, ₽').fill('15000');
    await page.getByLabel(/^Фото/).setInputFiles({
      name: 'bike.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(page.getByAltText('Фото 1')).toBeVisible();
    await page.getByRole('button', { name: 'Опубликовать' }).click();

    await expect(
      page.getByText(
        'Объявление «Велосипед Stels» в категории «Транспорт» отправлено на модерацию',
      ),
    ).toBeVisible();
    await expect(page.getByAltText('Велосипед Stels')).toBeVisible();
  });
});

// Т3. Список объявлений — примеры объявлений добавляет seed
test.describe('Т3. Просмотр списка объявлений', () => {
  test('гость видит список, фильтрует по рубрике и ищет по названию', async ({
    page,
  }) => {
    await page.goto('/');
    const list = page.getByRole('list', { name: 'Объявления' });
    await expect(list.getByText('Велосипед Stels Navigator')).toBeVisible();
    await expect(list.getByText('Ремонт стиральных машин')).toBeVisible();
    await expect(list.getByText('Договорная')).toBeVisible();

    await page.getByRole('button', { name: 'Транспорт' }).click();
    await expect(list.getByText('Ремонт стиральных машин')).toBeHidden();
    await expect(list.getByText('Велосипед Stels Navigator')).toBeVisible();

    await page.getByRole('button', { name: 'Все' }).click();
    await page.getByRole('searchbox', { name: /Поиск/ }).fill('ноутбук');
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(list.getByRole('link')).toHaveCount(1);
    await expect(list.getByText('Ноутбук Lenovo ThinkPad T480')).toBeVisible();
  });

  test('объявление на модерации в списке не видно', async ({ page }) => {
    await register(page, uniqueUser());
    await page.goto('/#/ads/new');
    await page.getByLabel('Заголовок').fill('Секретный шкаф');
    await page.getByLabel('Категория').selectOption({ label: 'Услуги' });
    await page.getByLabel('Описание').fill('Ещё не прошёл модерацию');
    await page.getByRole('button', { name: 'Опубликовать' }).click();
    await expect(page.getByText('отправлено на модерацию')).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('Ремонт стиральных машин')).toBeVisible();
    await expect(page.getByText('Секретный шкаф')).toBeHidden();
  });
});

// Т4. Карточка объявления
test.describe('Т4. Просмотр карточки объявления', () => {
  test('по клику открывается карточка с описанием, ценой и автором', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Ноутбук Lenovo/ }).click();

    await expect(page).toHaveURL(/#\/ads\/\d+$/);
    await expect(
      page.getByRole('heading', { name: 'Ноутбук Lenovo ThinkPad T480' }),
    ).toBeVisible();
    await expect(page.getByText('23 000 ₽')).toBeVisible();
    await expect(page.getByText('Продавец: Анна')).toBeVisible();
    // Описание выводится с переносами строк, как его ввёл автор
    const description = page.getByText(/Core i5/);
    await expect(description).toHaveCSS('white-space', 'pre-line');
    expect((await description.innerText()).split('\n')).toHaveLength(4);

    await page.getByRole('link', { name: 'Все объявления' }).click();
    await expect(page.getByRole('heading', { name: 'Рубрики' })).toBeVisible();
  });

  test('объявления не на сайте не открываются', async ({ page }) => {
    await page.goto('/#/ads/999999');
    await expect(page.getByRole('alert')).toHaveText('Объявление не найдено');
  });
});

// Т5. Редактирование и удаление
test.describe('Т5. Редактирование и удаление объявления', () => {
  async function publish(page: Page, title: string) {
    await page.goto('/#/ads/new');
    await page.getByLabel('Заголовок').fill(title);
    await page.getByLabel('Категория').selectOption({ label: 'Услуги' });
    await page.getByLabel('Описание').fill('Описание для проверки правок');
    await page.getByLabel('Цена, ₽').fill('1000');
    await page.getByRole('button', { name: 'Опубликовать' }).click();
    await expect(page.getByText('отправлено на модерацию')).toBeVisible();
  }

  test('автор меняет своё объявление', async ({ page }) => {
    await register(page, uniqueUser());
    await publish(page, 'Старая лампа');

    await page.getByRole('link', { name: 'Мои объявления' }).click();
    await expect(page.getByText('На проверке')).toBeVisible();
    await page.getByRole('link', { name: 'Изменить Старая лампа' }).click();

    await expect(page.getByLabel('Заголовок')).toHaveValue('Старая лампа');
    await expect(page.getByLabel('Категория')).toHaveValue(/\d+/);
    await page.getByLabel('Заголовок').fill('Новая лампа');
    await page.getByLabel('Цена, ₽').fill('');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    await expect(
      page.getByRole('heading', { name: 'Мои объявления' }),
    ).toBeVisible();
    const list = page.getByRole('list', { name: 'Мои объявления' });
    await expect(list.getByText('Новая лампа')).toBeVisible();
    await expect(list.getByText('Договорная')).toBeVisible();
    await expect(list.getByText('Старая лампа')).toBeHidden();
  });

  test('автор удаляет своё объявление', async ({ page }) => {
    await register(page, uniqueUser());
    await publish(page, 'Лишнее объявление');
    await page.getByRole('link', { name: 'Мои объявления' }).click();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Удалить Лишнее' }).click();
    await expect(page.getByText('Вы ещё ничего не подавали')).toBeVisible();
  });

  test('чужое объявление изменить нельзя', async ({ page }) => {
    await register(page, uniqueUser());
    await page.goto('/');
    await page.getByRole('link', { name: /Ноутбук Lenovo/ }).click();
    await expect(page.getByText('Продавец: Анна')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Изменить' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Удалить' })).toBeHidden();

    // Прямой адрес формы тоже не откроется
    const id = page.url().split('/').pop();
    await page.goto(`/#/ads/${id}/edit`);
    await expect(page.getByRole('alert')).toHaveText(
      'Можно менять только свои объявления',
    );
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeHidden();
  });

  test('автор видит кнопки на своей карточке', async ({ page }) => {
    await login(page, 'demo@board.local', 'demo12345');
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: /Ноутбук Lenovo/ }).click();
    await page.getByRole('link', { name: 'Изменить' }).click();
    await expect(page.getByLabel('Заголовок')).toHaveValue(/Ноутбук Lenovo/);
  });
});
