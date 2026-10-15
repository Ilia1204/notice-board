import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Роли, которым разрешён доступ к обработчику
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
