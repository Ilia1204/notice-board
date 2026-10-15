import { Test } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    }).compile();
    controller = moduleRef.get(CategoriesController);
  });

  it('передаёт запросы в сервис', async () => {
    await controller.findAll();
    await controller.create({ name: 'Книги' });
    await controller.update(1, { name: 'Литература' });
    await controller.remove(1);

    expect(service.findAll).toHaveBeenCalled();
    expect(service.create).toHaveBeenCalledWith({ name: 'Книги' });
    expect(service.update).toHaveBeenCalledWith(1, { name: 'Литература' });
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
