import { Test } from '@nestjs/testing';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

describe('AdsController', () => {
  let controller: AdsController;
  const service = {
    create: jest.fn(),
    findPublished: jest.fn(),
    findPublishedOne: jest.fn(),
    findByAuthor: jest.fn(),
    findOwn: jest.fn(),
    findPending: jest.fn(),
    moderate: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const user = { sub: 5, email: 'a@b.c', role: 'USER' as const };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdsController],
      providers: [{ provide: AdsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(AdsController);
  });

  it('отдаёт список с фильтрами из запроса', async () => {
    await controller.findAll({ categoryId: 3, q: 'велосипед' });
    expect(service.findPublished).toHaveBeenCalledWith({
      categoryId: 3,
      q: 'велосипед',
    });
  });

  it('открывает объявление по id', async () => {
    await controller.findOne(5);
    expect(service.findPublishedOne).toHaveBeenCalledWith(5);
  });

  it('публикует объявление от текущего пользователя', async () => {
    const dto = { title: 'Велосипед', description: 'Горный', categoryId: 1 };
    await controller.create({ sub: 5, email: 'a@b.c', role: 'USER' }, dto, []);
    expect(service.create).toHaveBeenCalledWith(5, dto, []);
  });

  it('отдаёт объявления текущего пользователя', async () => {
    await controller.findMine(user);
    expect(service.findByAuthor).toHaveBeenCalledWith(5);
    await controller.findMineOne(user, 7);
    expect(service.findOwn).toHaveBeenCalledWith(7, 5);
  });

  it('отдаёт очередь и передаёт решение модератора', async () => {
    await controller.findPending();
    expect(service.findPending).toHaveBeenCalled();
    await controller.moderate(7, { status: 'PUBLISHED' });
    expect(service.moderate).toHaveBeenCalledWith(7, 'PUBLISHED');
  });

  it('меняет и удаляет объявление от имени текущего пользователя', async () => {
    const dto = { title: 'Велосипед', description: 'Горный', categoryId: 1 };
    await controller.update(user, 7, dto, []);
    expect(service.update).toHaveBeenCalledWith(7, 5, dto, []);
    await controller.remove(user, 7);
    expect(service.remove).toHaveBeenCalledWith(7, 5);
  });
});
