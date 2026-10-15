import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  const contextWith = (user?: { role: Role }): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('пропускает, если роли не указаны', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWith())).toBe(true);
  });

  it('пропускает модератора к действиям модератора', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.MODERATOR]);
    expect(guard.canActivate(contextWith({ role: Role.MODERATOR }))).toBe(true);
  });

  it('не пускает обычного пользователя к действиям модератора', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.MODERATOR]);
    expect(() => guard.canActivate(contextWith({ role: Role.USER }))).toThrow(
      ForbiddenException,
    );
  });

  it('не пускает запрос без пользователя', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.MODERATOR]);
    expect(() => guard.canActivate(contextWith())).toThrow(ForbiddenException);
  });
});
