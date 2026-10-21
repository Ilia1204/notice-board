import { expect, test } from '@playwright/test';
import { login, register, uniqueUser } from './helpers';

// Т1. Регистрация и вход пользователя
test.describe('Т1. Регистрация и вход', () => {
  test('пользователь регистрируется и сразу оказывается в системе', async ({
    page,
  }) => {
    const user = uniqueUser();

    await register(page, user);

    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
    await expect(page.getByText('модератор', { exact: true })).toHaveCount(0);
  });

  test('повторная регистрация с тем же email запрещена', async ({ page }) => {
    const user = uniqueUser();
    await register(page, user);
    await page.getByRole('button', { name: 'Выйти' }).click();

    await page.goto('/#/register');
    await page.getByLabel('Имя').fill(user.name);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Пароль').fill(user.password);
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

    await expect(
      page.getByText('Пользователь с таким email уже существует'),
    ).toBeVisible();
  });

  test('пользователь выходит и снова входит по email и паролю', async ({
    page,
  }) => {
    const user = uniqueUser();
    await register(page, user);

    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();

    await login(page, user.email, user.password);
    await expect(page.getByText(user.name)).toBeVisible();
  });

  test('вход остаётся после перезагрузки страницы', async ({ page }) => {
    const user = uniqueUser();
    await register(page, user);

    await page.reload();

    await expect(page.getByText(user.name)).toBeVisible();
  });

  test('при неверном пароле показывается ошибка', async ({ page }) => {
    const user = uniqueUser();
    await register(page, user);
    await page.getByRole('button', { name: 'Выйти' }).click();

    await login(page, user.email, 'wrong-password');

    await expect(page.getByText('Неверный email или пароль')).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });
});
