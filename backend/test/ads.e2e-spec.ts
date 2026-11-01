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

  beforeAll(async () => {
    const prisma = createPrismaFake();
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

  it('не даёт удалить категорию с объявлениями', async () => {
    const res = await server()
      .delete('/categories/1')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(409);
    expect(res.body).toMatchObject({ message: 'В категории есть объявления' });
  });
});
