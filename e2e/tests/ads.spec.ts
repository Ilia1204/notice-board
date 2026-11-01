import { expect, test } from '@playwright/test';
import { register, uniqueUser } from './helpers';

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
