import { AdStatus, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

// Начальные данные: модератор, базовые категории и примеры объявлений
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

  await seedDemoAds();
}

// Пока нет модерации (Т6), примеры сразу опубликованы — чтобы главная не была пустой
const DEMO_ADS = [
  {
    title: 'Ноутбук Lenovo ThinkPad T480',
    description:
      'Core i5, 16 ГБ памяти, SSD 512 ГБ.\nБатарея держит около 5 часов.\n\nВ комплекте зарядка.',
    price: 23000,
    category: 'Электроника',
  },
  {
    title: 'Велосипед Stels Navigator',
    description:
      'Горный, 21 скорость, колёса 26 дюймов.\nКатался два сезона, после ТО.',
    price: 12500,
    category: 'Транспорт',
  },
  {
    title: 'Сдаю комнату у метро',
    description:
      'Комната 14 м², есть мебель и стиральная машина.\nБез животных.',
    price: 18000,
    category: 'Недвижимость',
  },
  {
    title: 'Ремонт стиральных машин',
    description: 'Выезд на дом в день обращения.\nЦена зависит от поломки.',
    price: null,
    category: 'Услуги',
  },
];

async function seedDemoAds() {
  const author = await prisma.user.upsert({
    where: { email: 'demo@board.local' },
    update: {},
    create: {
      email: 'demo@board.local',
      name: 'Анна',
      passwordHash: await argon2.hash('demo12345'),
    },
  });
  if (await prisma.ad.count({ where: { authorId: author.id } })) return;

  for (const { category, ...ad } of DEMO_ADS) {
    await prisma.ad.create({
      data: {
        ...ad,
        status: AdStatus.PUBLISHED,
        author: { connect: { id: author.id } },
        category: { connect: { name: category } },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
