import { expect, test } from '@playwright/test';
import { register, uniqueUser } from './helpers';

test.describe('Т9. Профиль пользователя', () => {
  test('гостя отправляет на страницу входа', async ({ page }) => {
    await page.goto('/#/profile');
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  });

  test('новое имя видно в шапке и после перезагрузки', async ({ page }) => {
    const user = uniqueUser();
    const name = `${user.name} новый`;
    await register(page, user);

    await page.getByRole('link', { name: user.name }).click();
    await expect(page.getByLabel('Email')).toHaveValue(user.email);
    await page.getByLabel('Имя').fill(name);
    await page.getByRole('button', { name: 'Сохранить' }).click();

    await expect(page.getByText('Изменения сохранены')).toBeVisible();
    await expect(page.getByRole('link', { name })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Имя')).toHaveValue(name);
  });

  test('после смены email вход работает с новым адресом', async ({ page }) => {
    const user = uniqueUser();
    const email = `new.${user.email}`;
    await register(page, user);

    await page.goto('/#/profile');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Изменения сохранены')).toBeVisible();

    await page.getByRole('button', { name: 'Выйти' }).click();
    await page.goto('/#/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль').fill(user.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByRole('link', { name: user.name })).toBeVisible();
  });

  test('чужой email занять нельзя', async ({ page }) => {
    const first = uniqueUser();
    await register(page, first);
    await page.getByRole('button', { name: 'Выйти' }).click();
    await register(page, uniqueUser());

    await page.goto('/#/profile');
    await page.getByLabel('Email').fill(first.email);
    await page.getByRole('button', { name: 'Сохранить' }).click();

    await expect(
      page.getByText('Пользователь с таким email уже существует'),
    ).toBeVisible();
  });

  test('в профиле видно своё объявление на проверке', async ({ page }) => {
    await register(page, uniqueUser());
    await page.getByRole('link', { name: 'Подать объявление' }).click();
    await page.getByLabel('Заголовок').fill('Самокат из профиля');
    await page.getByLabel('Категория').selectOption({ label: 'Транспорт' });
    await page.getByLabel('Описание').fill('Складной, почти новый');
    await page.getByRole('button', { name: 'Опубликовать' }).click();
    await expect(page.getByText(/отправлено на модерацию/)).toBeVisible();

    await page.goto('/#/profile');
    const list = page.getByRole('list', { name: 'Мои объявления' });
    await expect(list.getByText('Самокат из профиля')).toBeVisible();
    await expect(list.getByText('На проверке')).toBeVisible();
  });
});
