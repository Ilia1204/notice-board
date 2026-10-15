import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

// Начальные данные: учётная запись модератора и базовые категории
const prisma = new PrismaClient();

async function main() {
  const email = process.env.MODERATOR_EMAIL ?? 'moderator@board.local';
  const password = process.env.MODERATOR_PASSWORD ?? 'moderator123';

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Модератор',
      role: Role.MODERATOR,
      passwordHash: await argon2.hash(password),
    },
  });

  for (const name of ['Электроника', 'Недвижимость', 'Транспорт', 'Услуги']) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
