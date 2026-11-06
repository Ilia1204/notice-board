import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { toPublicUser } from '../auth/auth.service';
import type { PublicUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface UserProfile extends PublicUser {
  createdAt: Date;
}

const toProfile = (user: User): UserProfile => ({
  ...toPublicUser(user),
  createdAt: user.createdAt,
});

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: number): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Пользователь не найден');
    return toProfile(user);
  }

  async update(userId: number, dto: UpdateProfileDto): Promise<UserProfile> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { name: dto.name.trim(), email: dto.email.toLowerCase() },
      });
      return toProfile(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Пользователь с таким email уже существует',
          );
        }
        if (error.code === 'P2025') {
          throw new UnauthorizedException('Пользователь не найден');
        }
      }
      throw error;
    }
  }
}
