import { expect, test } from '@playwright/test';
import { register, uniqueUser } from './helpers';

// Т2. Публикация объявления
test.describe('Т2. Публикация объявления', () => {
  test('гостя отправляет на страницу входа', async ({ page }) => {
    await page.goto('/#/ads/new');
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  });

  test('пользователь публикует объявление', async ({ page }) => {
    await register(page, uniqueUser());
    await page.getByRole('link', { name: 'Подать объявление' }).click();

    await page.getByLabel('Заголовок').fill('Велосипед Stels');
    await page.getByLabel('Категория').selectOption({ label: 'Транспорт' });
    await page.getByLabel('Описание').fill('Горный, 21 скорость, почти новый');
    await page.getByLabel('Цена, ₽').fill('15000');
    await page.getByRole('button', { name: 'Опубликовать' }).click();

    await expect(
      page.getByText('Объявление «Велосипед Stels» опубликовано'),
    ).toBeVisible();
  });
});
