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

test.describe('Т11. Чат в реальном времени', () => {
  test('сообщения доходят до собеседника без перезагрузки', async ({
    page,
    browser,
  }) => {
    const buyer = uniqueUser();
    await register(page, buyer);
    await openAd(page);
    await page.getByRole('button', { name: 'Написать продавцу' }).click();
    await sendMessage(page, `Здравствуйте! ${Date.now()}`);

    const sellerContext = await browser.newContext();
    const seller = await sellerContext.newPage();
    await loginSeller(seller);
    await seller.getByRole('link', { name: 'Сообщения' }).click();
    await seller
      .getByRole('list', { name: 'Диалоги' })
      .getByRole('link')
      .filter({ hasText: buyer.name })
      .click();
    const sellerHistory = seller.getByRole('list', { name: 'Сообщения' });
    await expect(sellerHistory.getByText('Здравствуйте!')).toBeVisible();

    // Оба окна открыты, никто страницу не обновляет
    await sendMessage(page, 'Когда можно забрать?');
    await expect(sellerHistory.getByText('Когда можно забрать?')).toBeVisible();

    await sendMessage(seller, 'Сегодня после шести');
    await expect(
      page
        .getByRole('list', { name: 'Сообщения' })
        .getByText('Сегодня после шести'),
    ).toBeVisible();
    await sellerContext.close();
  });

  test('новый диалог сразу появляется в списке продавца', async ({
    page,
    browser,
  }) => {
    const sellerContext = await browser.newContext();
    const seller = await sellerContext.newPage();
    await loginSeller(seller);
    await seller.getByRole('link', { name: 'Сообщения' }).click();
    await expect(
      seller.getByRole('heading', { name: 'Сообщения' }),
    ).toBeVisible();

    const buyer = uniqueUser();
    const question = `Торг уместен? ${Date.now()}`;
    await register(page, buyer);
    await openAd(page);
    await page.getByRole('button', { name: 'Написать продавцу' }).click();
    await sendMessage(page, question);

    await expect(
      seller.getByRole('list', { name: 'Диалоги' }).getByRole('link').first(),
    ).toContainText(question);
    await sellerContext.close();
  });
});

test.describe('Т12. Уведомления о новых сообщениях', () => {
  test('ответ продавца виден в шапке и пропадает после прочтения', async ({
    page,
    browser,
  }) => {
    const buyer = uniqueUser();
    await register(page, buyer);
    await openAd(page);
    await page.getByRole('button', { name: 'Написать продавцу' }).click();
    await sendMessage(page, `Можно посмотреть? ${Date.now()}`);
    // Покупатель ушёл на главную, диалог у него закрыт
    await page.goto('/');
    const messagesLink = page.getByRole('link', { name: 'Сообщения' });
    await expect(messagesLink).not.toContainText(/\d/);

    // У продавца диалог выделен, пока он его не открыл
    const sellerContext = await browser.newContext();
    const seller = await sellerContext.newPage();
    await loginSeller(seller);
    await seller.getByRole('link', { name: 'Сообщения' }).click();
    const sellerChat = seller
      .getByRole('list', { name: 'Диалоги' })
      .getByRole('link')
      .filter({ hasText: buyer.name });
    await expect(sellerChat).toHaveClass(/chat-list__item--unread/);
    await expect(sellerChat.getByTitle('Непрочитанные сообщения')).toHaveText(
      '1',
    );
    await sellerChat.click();
    await sendMessage(seller, 'Да, приезжайте');

    // Без перезагрузки у покупателя появляется значок
    await expect(
      page.getByRole('link', { name: 'Сообщения, непрочитанных: 1' }),
    ).toBeVisible();
    await messagesLink.click();
    const buyerChat = page
      .getByRole('list', { name: 'Диалоги' })
      .getByRole('link')
      .first();
    await expect(buyerChat).toHaveClass(/chat-list__item--unread/);
    await buyerChat.click();
    await expect(page.getByText('Да, приезжайте')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Сообщения', exact: true }),
    ).toBeVisible();

    // У продавца диалог тоже прочитан
    await seller.getByRole('link', { name: 'Все диалоги' }).click();
    await expect(sellerChat).not.toHaveClass(/chat-list__item--unread/);
    await sellerContext.close();
  });
});
