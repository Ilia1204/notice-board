import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MAX_IMAGE_SIZE, MAX_IMAGES } from '../src/ads/image-storage.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

// Начало настоящих PNG и JPG — сервер проверяет формат по содержимому
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe('Ads (e2e)', () => {
  let app: INestApplication<App>;
  let moderatorToken: string;
  let userToken: string;
  let strangerToken: string;
  let prisma: ReturnType<typeof createPrismaFake>;

  beforeAll(async () => {
    prisma = createPrismaFake();
    prisma.users.push({
      id: 2,
      email: 'ivan@mail.ru',
      name: 'Иван',
      passwordHash: 'hash',
      role: 'USER',
      createdAt: new Date(),
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const jwt = app.get(JwtService);
    moderatorToken = await jwt.signAsync({
      sub: 1,
      email: 'moderator@board.local',
      role: 'MODERATOR',
    });
    userToken = await jwt.signAsync({
      sub: 2,
      email: 'ivan@mail.ru',
      role: 'USER',
    });
    strangerToken = await jwt.signAsync({
      sub: 3,
      email: 'petr@mail.ru',
      role: 'USER',
    });

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: 'Транспорт' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const bike = {
    title: 'Велосипед',
    description: 'Горный, 21 скорость, почти новый',
    price: 15000,
    categoryId: 1,
  };

  it('гость не может опубликовать объявление', () => {
    return server().post('/ads').send(bike).expect(401);
  });

  it('пользователь публикует объявление', async () => {
    const res = await server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send(bike)
      .expect(201);
    expect(res.body).toMatchObject({
      id: 1,
      title: 'Велосипед',
      price: 15000,
      status: 'PENDING',
      category: { id: 1, name: 'Транспорт' },
      author: { id: 2, name: 'Иван' },
    });
    expect(res.body).not.toHaveProperty('author.email');
  });

  it('принимает форму с фото', async () => {
    const res = await server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'Диван')
      .field('description', 'Раскладной, серый, без пятен')
      .field('categoryId', '1')
      .attach('images', PNG, {
        filename: 'sofa.png',
        contentType: 'image/png',
      })
      .attach('images', JPEG, {
        filename: 'sofa-2.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    const body = res.body as { price: null; images: { filename: string }[] };
    expect(body.price).toBeNull();
    expect(body.images.map((i) => i.filename.split('.').pop())).toEqual([
      'png',
      'jpg',
    ]);
  });

  it('не принимает файлы, которые не являются фото', async () => {
    const res = await server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'Диван')
      .field('description', 'Раскладной, серый, без пятен')
      .field('categoryId', '1')
      .attach('images', Buffer.from('%PDF'), {
        filename: 'sofa.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(res.body).toMatchObject({
      message: 'Фото должны быть в формате JPG, PNG или WEBP',
    });
  });

  it('не принимает файл, выданный за фото', async () => {
    const res = await server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .field('title', 'Диван')
      .field('description', 'Раскладной, серый, без пятен')
      .field('categoryId', '1')
      .attach('images', Buffer.from('<script>alert(1)</script>'), {
        filename: 'sofa.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(res.body).toMatchObject({
      message: 'Фото должны быть в формате JPG, PNG или WEBP',
    });
  });

  describe('ошибки загрузки фото — на русском', () => {
    const form = () =>
      server()
        .post('/ads')
        .set('Authorization', `Bearer ${userToken}`)
        .field('title', 'Диван')
        .field('description', 'Раскладной, серый, без пятен')
        .field('categoryId', '1');

    it('слишком много файлов', async () => {
      let req = form();
      for (let i = 0; i <= MAX_IMAGES * 2; i++) {
        req = req.attach('images', PNG, `photo-${i}.png`);
      }
      const res = await req.expect(400);
      expect(res.body).toMatchObject({
        message: `Можно прикрепить не больше ${MAX_IMAGES} фото`,
      });
    });

    it('слишком большой файл', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_SIZE * 2)]);
      const res = await form().attach('images', big, 'big.png').expect(400);
      expect(res.body).toMatchObject({
        message: 'Каждое фото должно быть не больше 5 МБ',
      });
    });

    it('фото в другом поле формы', async () => {
      const res = await form().attach('photo', PNG, 'sofa.png').expect(400);
      expect(res.body).toMatchObject({
        message: 'Фото нужно прикреплять в поле images',
      });
    });
  });

  it('проверяет поля объявления', async () => {
    const res = await server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Ве', description: 'Коротко', price: -5 })
      .expect(400);
    expect((res.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([
        'Заголовок должен быть не короче 3 символов',
        'Цена не может быть отрицательной',
        'Выберите категорию',
      ]),
    );
  });

  it('не принимает заголовок и описание из одних пробелов', async () => {
    const res = await server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ...bike, title: '     ', description: '            ' })
      .expect(400);
    expect((res.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([
        'Заголовок должен быть не короче 3 символов',
        'Описание должно быть не короче 10 символов',
      ]),
    );
  });

  it('отклоняет несуществующую категорию', () => {
    return server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ...bike, categoryId: 99 })
      .expect(400);
  });

  describe('список объявлений', () => {
    beforeAll(async () => {
      await server()
        .post('/categories')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ name: 'Мебель' })
        .expect(201);
      for (const [title, categoryId] of [
        ['Велосипед детский', 1],
        ['Шкаф-купе', 2],
      ] as const) {
        await server()
          .post('/ads')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ ...bike, title, categoryId })
          .expect(201);
      }
      // Модерации ещё нет (Т6) — публикуем два последних напрямую
      prisma.ads.slice(-2).forEach((ad) => (ad.status = 'PUBLISHED'));
    });

    const titles = (body: unknown) =>
      (body as { title: string }[]).map((ad) => ad.title);

    it('гость видит только опубликованные, новые сверху', async () => {
      const res = await server().get('/ads').expect(200);
      expect(titles(res.body)).toEqual(['Шкаф-купе', 'Велосипед детский']);
      expect(res.body).not.toHaveProperty('0.author.email');
    });

    it('фильтрует по рубрике', async () => {
      const res = await server().get('/ads?categoryId=2').expect(200);
      expect(titles(res.body)).toEqual(['Шкаф-купе']);
    });

    it('ищет по названию без учёта регистра', async () => {
      const res = await server().get('/ads?q=%20ВЕЛОСИПЕД%20').expect(200);
      expect(titles(res.body)).toEqual(['Велосипед детский']);
    });

    it('открывает карточку опубликованного объявления', async () => {
      const id = prisma.ads.at(-1)!.id;
      const res = await server().get(`/ads/${id}`).expect(200);
      expect(res.body).toMatchObject({
        title: 'Шкаф-купе',
        description: bike.description,
        category: { name: 'Мебель' },
        author: { id: 2, name: 'Иван' },
      });
      expect(res.body).not.toHaveProperty('author.email');
    });

    it('не открывает объявление на модерации', async () => {
      const res = await server().get('/ads/1').expect(404);
      expect(res.body).toMatchObject({ message: 'Объявление не найдено' });
    });

    it('не принимает id не числом', () => {
      return server().get('/ads/abc').expect(400);
    });

    it('не принимает неверную рубрику', () => {
      return server().get('/ads?categoryId=abc').expect(400);
    });
  });

  describe('редактирование и удаление', () => {
    let adId: number;
    let photoIds: number[];
    const as = (token: string) => `Bearer ${token}`;

    // Объявление с двумя фото, уже прошедшее модерацию
    beforeEach(async () => {
      const res = await server()
        .post('/ads')
        .set('Authorization', as(userToken))
        .field('title', 'Самокат')
        .field('description', 'Складной, колёса целые')
        .field('categoryId', '1')
        .attach('images', PNG, 'a.png')
        .attach('images', JPEG, 'b.jpg')
        .expect(201);
      const body = res.body as { id: number; images: { id: number }[] };
      adId = body.id;
      photoIds = body.images.map((image) => image.id);
      prisma.ads.find((ad) => ad.id === adId)!.status = 'PUBLISHED';
    });

    it('гость не видит раздел «Мои объявления»', () => {
      return server().get('/ads/mine').expect(401);
    });

    it('автор видит свои объявления с любым статусом', async () => {
      const res = await server()
        .get('/ads/mine')
        .set('Authorization', as(userToken))
        .expect(200);
      const statuses = (res.body as { status: string }[]).map((a) => a.status);
      expect(statuses).toEqual(
        expect.arrayContaining(['PENDING', 'PUBLISHED']),
      );
    });

    it('в чужом списке объявлений автора нет', async () => {
      const res = await server()
        .get('/ads/mine')
        .set('Authorization', as(strangerToken))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('автор открывает своё объявление на проверке, чужой — нет', async () => {
      await server()
        .get('/ads/mine/1')
        .set('Authorization', as(userToken))
        .expect(200);
      await server()
        .get('/ads/mine/1')
        .set('Authorization', as(strangerToken))
        .expect(403);
    });

    it('автор меняет объявление, и оно снова уходит на проверку', async () => {
      const res = await server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(userToken))
        .send({ ...bike, title: 'Самокат новый', price: 3000 })
        .expect(200);
      expect(res.body).toMatchObject({
        title: 'Самокат новый',
        price: 3000,
        status: 'PENDING',
      });
      await server().get(`/ads/${adId}`).expect(404);
    });

    it('автор убирает цену', async () => {
      await server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(userToken))
        .send({ ...bike, price: 3000 })
        .expect(200);
      const res = await server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(userToken))
        .send({ ...bike, price: undefined })
        .expect(200);
      expect(res.body).toMatchObject({ price: null });
    });

    it('автор убирает одно фото и добавляет другое', async () => {
      const res = await server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(userToken))
        .field('title', 'Самокат')
        .field('description', 'Складной, колёса целые')
        .field('categoryId', '1')
        .field('removeImageIds', String(photoIds[0]))
        .attach('images', PNG, 'c.png')
        .expect(200);
      const images = (res.body as { images: { filename: string }[] }).images;
      expect(images.map((i) => i.filename.split('.').pop())).toEqual([
        'jpg',
        'png',
      ]);
    });

    it('убирает сразу несколько фото', async () => {
      const res = await server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(userToken))
        .field('title', 'Самокат')
        .field('description', 'Складной, колёса целые')
        .field('categoryId', '1')
        .field('removeImageIds', String(photoIds[0]))
        .field('removeImageIds', String(photoIds[1]))
        .expect(200);
      expect(res.body).toMatchObject({ images: [] });
    });

    it('проверяет поля так же, как при создании', async () => {
      const res = await server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(userToken))
        .send({ ...bike, title: 'Ве' })
        .expect(400);
      expect((res.body as { message: string[] }).message).toContain(
        'Заголовок должен быть не короче 3 символов',
      );
    });

    it('не принимает несуществующую категорию', () => {
      return server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(userToken))
        .send({ ...bike, categoryId: 99 })
        .expect(400);
    });

    it('гость не может изменить или удалить объявление', async () => {
      await server().patch(`/ads/${adId}`).send(bike).expect(401);
      await server().delete(`/ads/${adId}`).expect(401);
    });

    it('чужое объявление изменить и удалить нельзя', async () => {
      const edit = await server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(strangerToken))
        .send({ ...bike, title: 'Взлом' })
        .expect(403);
      expect(edit.body).toMatchObject({
        message: 'Можно менять только свои объявления',
      });
      await server()
        .delete(`/ads/${adId}`)
        .set('Authorization', as(strangerToken))
        .expect(403);

      const res = await server().get(`/ads/${adId}`).expect(200);
      expect(res.body).toMatchObject({ title: 'Самокат' });
    });

    it('модератор не меняет чужие объявления как автор', () => {
      return server()
        .patch(`/ads/${adId}`)
        .set('Authorization', as(moderatorToken))
        .send(bike)
        .expect(403);
    });

    it('автор удаляет объявление, и оно пропадает с сайта', async () => {
      await server()
        .delete(`/ads/${adId}`)
        .set('Authorization', as(userToken))
        .expect(204);
      await server().get(`/ads/${adId}`).expect(404);
    });

    it('сообщает, если объявления нет', async () => {
      const res = await server()
        .delete('/ads/99999')
        .set('Authorization', as(userToken))
        .expect(404);
      expect(res.body).toMatchObject({ message: 'Объявление не найдено' });
    });
  });

  it('не даёт удалить категорию с объявлениями', async () => {
    const res = await server()
      .delete('/categories/1')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(409);
    expect(res.body).toMatchObject({ message: 'В категории есть объявления' });
  });
});
