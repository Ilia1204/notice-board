import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { login, register, uniqueUser } from './helpers';

// Продавец и объявление — из seed
const SELLER = { email: 'demo@board.local', password: 'demo12345' };
const AD = 'Велосипед Stels Navigator';

async function loginSeller(page: Page) {
  await login(page, SELLER.email, SELLER.password);
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
}

async function openAd(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: new RegExp(AD) }).click();
  await expect(page.getByRole('heading', { name: AD })).toBeVisible();
}

async function sendMessage(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Сообщение' }).fill(text);
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(
    page.getByRole('list', { name: 'Сообщения' }).getByText(text),
  ).toBeVisible();
}

test.describe('Т10. Диалоги и история сообщений', () => {
  test('гостя отправляет на страницу входа', async ({ page }) => {
    await openAd(page);
    await page.getByRole('link', { name: 'Написать продавцу' }).click();
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();

    await page.goto('/#/chats');
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  });

  test('покупатель пишет автору, диалог и история сохраняются', async ({
    page,
    browser,
  }) => {
    const buyer = uniqueUser();
    const question = `Ещё продаёте? ${Date.now()}`;
    await register(page, buyer);
    await openAd(page);
    await page.getByRole('button', { name: 'Написать продавцу' }).click();
    await expect(page.getByRole('heading', { name: 'Анна' })).toBeVisible();
    await sendMessage(page, question);

    // Продавец в своём окне видит диалог и отвечает
    const sellerContext = await browser.newContext();
    const seller = await sellerContext.newPage();
    await loginSeller(seller);
    await seller.getByRole('link', { name: 'Сообщения' }).click();
    const chat = seller
      .getByRole('list', { name: 'Диалоги' })
      .getByRole('link')
      .filter({ hasText: buyer.name });
    await expect(chat).toContainText(AD);
    await expect(chat).toContainText(question);
    await chat.click();
    await sendMessage(seller, 'Да, продаю');
    await sellerContext.close();

    // Ответ виден покупателю после перезагрузки
    await page.reload();
    const history = page.getByRole('list', { name: 'Сообщения' });
    await expect(history.getByText(question)).toBeVisible();
    await expect(history.getByText('Да, продаю')).toBeVisible();

    await page.getByRole('link', { name: 'Сообщения' }).click();
    await expect(
      page.getByRole('list', { name: 'Диалоги' }).getByRole('link').first(),
    ).toContainText('Да, продаю');
  });

  test('повторное нажатие открывает тот же диалог', async ({ page }) => {
    await register(page, uniqueUser());
    await openAd(page);
    await page.getByRole('button', { name: 'Написать продавцу' }).click();
    await sendMessage(page, 'Можно посмотреть завтра?');

    await openAd(page);
    await page.getByRole('button', { name: 'Написать продавцу' }).click();
    await expect(
      page
        .getByRole('list', { name: 'Сообщения' })
        .getByText('Можно посмотреть завтра?'),
    ).toBeVisible();
  });

  test('автор не пишет сам себе', async ({ page }) => {
    await loginSeller(page);
    await openAd(page);
    await expect(page.getByRole('link', { name: 'Изменить' })).toBeVisible();
    await expect(page.getByText('Написать продавцу')).toHaveCount(0);
  });
});
