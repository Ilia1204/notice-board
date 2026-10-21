import { expect, test } from '@playwright/test';
import { login, MODERATOR, register, uniqueUser } from './helpers';

// Т7. Управление категориями (только модератор)
test.describe('Т7. Управление категориями', () => {
  test('обычный пользователь не видит раздел категорий', async ({ page }) => {
    await register(page, uniqueUser());

    await expect(page.getByRole('link', { name: 'Категории' })).toHaveCount(0);
    await page.goto('/#/categories');
    await expect(
      page.getByText('Раздел доступен только модераторам.'),
    ).toBeVisible();
  });

  test.describe('модератор', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, MODERATOR.email, MODERATOR.password);
      await expect(page.getByText('модератор', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Категории' }).click();
      await expect(
        page.getByRole('heading', { name: 'Категории' }),
      ).toBeVisible();
    });

    test('создаёт, изменяет и удаляет категорию', async ({ page }) => {
      const name = `Хобби ${Date.now()}`;
      const renamed = `${name} и спорт`;

      await page.getByLabel('Название').fill(name);
      await page.getByLabel('Описание').fill('Настольные игры, рукоделие');
      await page.getByRole('button', { name: 'Добавить' }).click();
      await expect(page.getByText(name, { exact: true })).toBeVisible();

      await page.getByRole('button', { name: `Изменить ${name}` }).click();
      await page.getByLabel('Название').nth(1).fill(renamed);
      await page.getByRole('button', { name: 'Сохранить' }).click();
      await expect(page.getByText(renamed, { exact: true })).toBeVisible();

      page.once('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: `Удалить ${renamed}` }).click();
      await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
    });

    test('новая категория появляется на главной странице', async ({ page }) => {
      const name = `Животные ${Date.now()}`;
      await page.getByLabel('Название').fill(name);
      await page.getByRole('button', { name: 'Добавить' }).click();
      await expect(page.getByText(name, { exact: true })).toBeVisible();

      await page.goto('/');
      await expect(page.getByText(name, { exact: true })).toBeVisible();

      await page.goto('/#/categories');
      page.once('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: `Удалить ${name}` }).click();
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    });

    test('не может создать категорию с существующим названием', async ({
      page,
    }) => {
      await page.getByLabel('Название').fill('Электроника');
      await page.getByRole('button', { name: 'Добавить' }).click();

      await expect(
        page.getByText('Категория с таким названием уже есть'),
      ).toBeVisible();
    });

    test('отмена удаления оставляет категорию на месте', async ({ page }) => {
      page.once('dialog', (dialog) => void dialog.dismiss());
      await page.getByRole('button', { name: 'Удалить Транспорт' }).click();

      await expect(page.getByText('Транспорт', { exact: true })).toBeVisible();
    });
  });
});
