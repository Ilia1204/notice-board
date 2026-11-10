import { Test } from '@nestjs/testing';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

describe('ComplaintsController', () => {
  let controller: ComplaintsController;
  const service = {
    create: jest.fn(),
    findOpen: jest.fn(),
    resolve: jest.fn(),
  };
  const user = { sub: 5, email: 'a@b.c', role: 'USER' as const };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ComplaintsController],
      providers: [{ provide: ComplaintsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(ComplaintsController);
  });

  it('берёт автора жалобы из токена и передаёт решение модератора', async () => {
    const dto = { adId: 7, reason: 'SPAM' as const };
    await controller.create(user, dto);
    await controller.findOpen();
    await controller.resolve(3, { status: 'ACCEPTED' });
    expect(service.create).toHaveBeenCalledWith(5, dto);
    expect(service.findOpen).toHaveBeenCalled();
    expect(service.resolve).toHaveBeenCalledWith(3, 'ACCEPTED');
  });
});
