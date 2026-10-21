import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const MODERATOR = {
  email: process.env.MODERATOR_EMAIL ?? 'moderator@board.local',
  password: process.env.MODERATOR_PASSWORD ?? 'moderator123',
};

// Уникальные данные, чтобы тесты не мешали друг другу в общей базе
export function uniqueUser() {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: `Тестовый ${id}`,
    email: `user${id}@test.local`,
    password: 'secret123',
  };
}

export async function register(
  page: Page,
  user: ReturnType<typeof uniqueUser>,
) {
  await page.goto('/#/register');
  await page.getByLabel('Имя').fill(user.name);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Пароль').fill(user.password);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page.getByText(user.name)).toBeVisible();
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/#/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}
