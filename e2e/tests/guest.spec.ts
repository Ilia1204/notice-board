import { expect, test } from '@playwright/test';

test.describe('Гость', () => {
  test('видит главную страницу и категории объявлений', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /рядом с вами/ }),
    ).toBeVisible();
    await expect(page.getByText('Электроника')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Регистрация' })).toBeVisible();
  });

  test('не может открыть управление категориями без входа', async ({
    page,
  }) => {
    await page.goto('/#/categories');

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  });
});
