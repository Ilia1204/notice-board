import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { login, MODERATOR, register, uniqueUser } from './helpers';

// Своё объявление у каждого теста: принятая жалоба скрывает его с сайта
async function publishAd(page: Page) {
  const seller = uniqueUser();
  const title = `Жалоба ${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await register(page, seller);
  await page.goto('/#/ads/new');
  await page.getByLabel('Заголовок').fill(title);
  await page.getByLabel('Категория').selectOption({ label: 'Услуги' });
  // С ценой: в списке Т3 «Договорная» должна остаться только у сида
  await page.getByLabel('Цена, ₽').fill('500');
  await page.getByLabel('Описание').fill('Объявление для проверки жалоб');
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByText('отправлено на модерацию')).toBeVisible();
  await page.getByRole('button', { name: 'Выйти' }).click();

  await loginModerator(page);
  await page.getByRole('link', { name: 'Модерация' }).click();
  await page
    .getByRole('list', { name: 'Объявления на проверке' })
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('button', { name: 'Опубликовать' })
    .click();
  await expect(page.getByText(title)).toBeHidden();
  await page.getByRole('button', { name: 'Выйти' }).click();
  return { title, seller };
}

async function loginModerator(page: Page) {
  await login(page, MODERATOR.email, MODERATOR.password);
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
}

async function openAd(page: Page, title: string) {
  await page.goto('/');
  await page.getByRole('searchbox', { name: /Поиск/ }).fill(title);
  await page.getByRole('button', { name: 'Найти' }).click();
  await page.getByRole('link', { name: new RegExp(title) }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function complain(
  page: Page,
  link: string,
  reason: string,
  comment = '',
) {
  await page.getByRole('button', { name: link }).click();
  await page.getByRole('radio', { name: reason }).check();
  if (comment) await page.getByLabel(/Комментарий/).fill(comment);
  await page.getByRole('button', { name: 'Отправить жалобу' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Жалоба отправлена. Модератор её рассмотрит.',
  );
}

const complaintItem = (page: Page, text: string) =>
  page
    .getByRole('list', { name: 'Жалобы на рассмотрении' })
    .getByRole('listitem')
    .filter({ hasText: text });

test.describe('Т13. Жалобы на объявления и пользователей', () => {
  test('гость не видит жалоб, пользователю раздел модератора недоступен', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Велосипед Stels Navigator/ }).click();
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Пожаловаться/ }),
    ).toBeHidden();

    await register(page, uniqueUser());
    await expect(page.getByRole('link', { name: 'Жалобы' })).toBeHidden();
    await page.goto('/#/complaints');
    await expect(
      page.getByText('Раздел доступен только модераторам.'),
    ).toBeVisible();
  });

  test('модератор принимает жалобу — объявление пропадает с сайта', async ({
    page,
  }) => {
    const { title } = await publishAd(page);
    await register(page, uniqueUser());
    await openAd(page, title);
    await complain(
      page,
      'Пожаловаться на объявление',
      'Мошенничество',
      'Просит предоплату на карту',
    );
    // Повторно до решения модератора не принимается
    await page
      .getByRole('button', { name: 'Пожаловаться на объявление' })
      .click();
    await page.getByRole('button', { name: 'Отправить жалобу' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Вы уже пожаловались, жалоба на рассмотрении',
    );
    await page.getByRole('button', { name: 'Выйти' }).click();

    await loginModerator(page);
    await page.getByRole('link', { name: 'Жалобы' }).click();
    const item = complaintItem(page, title);
    await expect(item).toContainText('Мошенничество');
    await expect(item).toContainText('Просит предоплату на карту');
    await item.getByRole('button', { name: 'Скрыть объявление' }).click();
    await expect(item).toBeHidden();

    await page.goto('/');
    await page.getByRole('searchbox', { name: /Поиск/ }).fill(title);
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText('Ничего не нашлось')).toBeVisible();
  });

  test('отклонённая жалоба оставляет объявление на сайте', async ({ page }) => {
    const { title } = await publishAd(page);
    await register(page, uniqueUser());
    await openAd(page, title);
    await complain(page, 'Пожаловаться на объявление', 'Спам или реклама');
    await page.getByRole('button', { name: 'Выйти' }).click();

    await loginModerator(page);
    await page.getByRole('link', { name: 'Жалобы' }).click();
    const item = complaintItem(page, title);
    await item.getByRole('button', { name: 'Отклонить жалобу' }).click();
    await expect(item).toBeHidden();

    await openAd(page, title);
  });

  test('жалоба на продавца скрывает все его объявления', async ({ page }) => {
    const { title, seller } = await publishAd(page);
    await register(page, uniqueUser());
    await openAd(page, title);
    await complain(page, 'на продавца', 'Оскорбления', 'Грубит в переписке');
    await page.getByRole('button', { name: 'Выйти' }).click();

    await loginModerator(page);
    await page.getByRole('link', { name: 'Жалобы' }).click();
    const item = complaintItem(page, `Пользователь ${seller.name}`);
    await expect(item).toContainText('Грубит в переписке');
    await item
      .getByRole('button', { name: 'Скрыть все объявления пользователя' })
      .click();
    await expect(item).toBeHidden();

    await page.goto('/');
    await page.getByRole('searchbox', { name: /Поиск/ }).fill(title);
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText('Ничего не нашлось')).toBeVisible();
  });
});
