import type { User } from '@prisma/client';

// Простая замена PrismaService в памяти для интеграционных тестов
export function createPrismaFake() {
  const users: User[] = [];

  return {
    users,
    user: {
      findUnique: ({ where }: { where: { id?: number; email?: string } }) =>
        Promise.resolve(
          users.find((u) => u.id === where.id || u.email === where.email) ??
            null,
        ),
      create: ({ data }: { data: Omit<User, 'id' | 'role' | 'createdAt'> }) => {
        const user: User = {
          id: users.length + 1,
          role: 'USER',
          createdAt: new Date(),
          ...data,
        };
        users.push(user);
        return Promise.resolve(user);
      },
    },
    $disconnect: () => Promise.resolve(),
  };
}
