import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let moderatorToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(createPrismaFake())
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
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it('модератор создаёт категорию', async () => {
    const res = await server()
      .post('/categories')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: 'Книги', description: 'Учебники и художественная' })
      .expect(201);
    expect(res.body).toMatchObject({ id: 1, name: 'Книги' });
  });

  it('гость видит список категорий', async () => {
    const res = await server().get('/categories').expect(200);
    expect(res.body).toEqual([expect.objectContaining({ name: 'Книги' })]);
  });

  it('гость не может создать категорию', () => {
    return server().post('/categories').send({ name: 'Музыка' }).expect(401);
  });

  it('обычный пользователь не может создать категорию', () => {
    return server()
      .post('/categories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Музыка' })
      .expect(403);
  });

  it('не создаёт дубликат и пустое название', async () => {
    await server()
      .post('/categories')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: 'Книги' })
      .expect(409);
    await server()
      .post('/categories')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: '' })
      .expect(400);
    await server()
      .post('/categories')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: '    ' })
      .expect(400);
  });

  it('модератор переименовывает и удаляет категорию', async () => {
    await server()
      .patch('/categories/1')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: 'Литература' })
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ name: 'Литература' }));

    await server()
      .delete('/categories/1')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(204);
    await server()
      .delete('/categories/1')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(404);
  });
});
