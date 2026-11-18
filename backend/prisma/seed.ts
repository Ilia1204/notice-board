import {
  AdStatus,
  ComplaintReason,
  ComplaintStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as argon2 from 'argon2';

// Начальные данные: модераторы, категории, пользователи и примеры объявлений
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

  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await seedDemoAds();
  await seedMarket();
}

const CATEGORIES = [
  'Электроника',
  'Недвижимость',
  'Транспорт',
  'Услуги',
  'Одежда и обувь',
  'Дом и сад',
  'Хобби и отдых',
  'Детские товары',
];

// Объявления Анны, на них опираются e2e-тесты: названия и цены не менять
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

// Демонстрационная доска: модераторы, пользователи, объявления, диалоги и жалобы.
// Цена у всех указана: «Договорная» в e2e-тестах должна быть только у Анны
const MODERATORS = [
  { email: 'olga@board.local', name: 'Ольга Смирнова' },
  { email: 'dmitry@board.local', name: 'Дмитрий Козлов' },
];

const USERS = [
  { key: 'ivan', name: 'Иван Петров' },
  { key: 'maria', name: 'Мария Соколова' },
  { key: 'sergey', name: 'Сергей Волков' },
  { key: 'elena', name: 'Елена Новикова' },
  { key: 'spam', name: 'Быстрые деньги' },
] as const;

type UserKey = (typeof USERS)[number]['key'];

const MARKET_ADS: {
  key: string;
  author: UserKey;
  title: string;
  description: string;
  price: number;
  category: string;
  status: AdStatus;
  daysAgo: number;
}[] = [
  {
    key: 'iphone',
    author: 'ivan',
    title: 'iPhone 12, 128 ГБ, чёрный',
    description:
      'Пользовался два года в чехле, царапин на экране нет.\nАккумулятор 87 %.\n\nКоробка и кабель в комплекте.',
    price: 28000,
    category: 'Электроника',
    status: AdStatus.PUBLISHED,
    daysAgo: 1,
  },
  {
    key: 'tyres',
    author: 'ivan',
    title: 'Зимние шины Nokian Hakkapeliitta R17',
    description:
      '225/45 R17, комплект из четырёх.\nОткатали один сезон, шипы на месте.',
    price: 16000,
    category: 'Транспорт',
    status: AdStatus.PUBLISHED,
    daysAgo: 6,
  },
  {
    key: 'drill',
    author: 'ivan',
    title: 'Перфоратор Makita HR2470',
    description: 'Рабочий, в кейсе, с набором буров.\nПродаю после ремонта.',
    price: 6500,
    category: 'Дом и сад',
    status: AdStatus.PUBLISHED,
    daysAgo: 9,
  },
  {
    key: 'stroller',
    author: 'maria',
    title: 'Детская коляска Cybex 2 в 1',
    description:
      'Люлька и прогулочный блок, дождевик и сумка.\nОдин ребёнок, без поломок.',
    price: 14000,
    category: 'Детские товары',
    status: AdStatus.PUBLISHED,
    daysAgo: 3,
  },
  {
    key: 'jacket',
    author: 'maria',
    title: 'Пуховик женский, размер 44',
    description: 'Длинный, с капюшоном, цвет бежевый.\nНосила одну зиму.',
    price: 4500,
    category: 'Одежда и обувь',
    status: AdStatus.PUBLISHED,
    daysAgo: 5,
  },
  {
    key: 'chest',
    author: 'maria',
    title: 'Комод IKEA Hemnes, белый',
    description: 'Восемь ящиков, без сколов.\nСамовывоз, разберу сама.',
    price: 7000,
    category: 'Дом и сад',
    status: AdStatus.PENDING,
    daysAgo: 0,
  },
  {
    key: 'guitar',
    author: 'sergey',
    title: 'Гитара Yamaha F310',
    description:
      'Акустическая, новые струны.\nОтдам вместе с чехлом и каподастром.',
    price: 9000,
    category: 'Хобби и отдых',
    status: AdStatus.PUBLISHED,
    daysAgo: 2,
  },
  {
    key: 'tent',
    author: 'sergey',
    title: 'Палатка трёхместная Outventure',
    description: 'Ставил три раза, всё целое.\nВес 4 кг.',
    price: 5500,
    category: 'Хобби и отдых',
    status: AdStatus.PUBLISHED,
    daysAgo: 8,
  },
  {
    key: 'flat',
    author: 'sergey',
    title: 'Сдаю однокомнатную квартиру на длительный срок',
    description:
      '38 м², пятый этаж, есть мебель и техника.\nСемье или одному человеку, без животных.\n\nКоммунальные платежи отдельно.',
    price: 32000,
    category: 'Недвижимость',
    status: AdStatus.PUBLISHED,
    daysAgo: 4,
  },
  {
    key: 'monitor',
    author: 'sergey',
    title: 'Монитор Samsung 27 дюймов',
    description: 'IPS, 75 Гц, без битых пикселей.\nВ коробке.',
    price: 11000,
    category: 'Электроника',
    status: AdStatus.PENDING,
    daysAgo: 0,
  },
  {
    key: 'english',
    author: 'elena',
    title: 'Уроки английского онлайн',
    description:
      'Преподаю восемь лет, готовлю к ОГЭ и ЕГЭ.\nЦена за занятие 60 минут.',
    price: 1200,
    category: 'Услуги',
    status: AdStatus.PUBLISHED,
    daysAgo: 7,
  },
  {
    key: 'lego',
    author: 'elena',
    title: 'Конструктор LEGO City «Пожарная часть»',
    description: 'Собирали один раз, все детали на месте.\nЕсть инструкция.',
    price: 2500,
    category: 'Детские товары',
    status: AdStatus.PUBLISHED,
    daysAgo: 2,
  },
  {
    key: 'sneakers',
    author: 'elena',
    title: 'Кроссовки, размер 38',
    description: 'Новые.',
    price: 3500,
    category: 'Одежда и обувь',
    status: AdStatus.REJECTED,
    daysAgo: 10,
  },
  {
    key: 'easy-money',
    author: 'spam',
    title: 'Заработок от 100 000 в неделю без вложений',
    description: 'Пиши в личку, всё расскажу!!! Места ограничены!!!',
    price: 100,
    category: 'Услуги',
    status: AdStatus.PUBLISHED,
    daysAgo: 1,
  },
  {
    key: 'fake-iphone',
    author: 'spam',
    title: 'iPhone 15 Pro, новый, оригинал',
    description: 'Из Дубая, гарантия. Только предоплата на карту.',
    price: 15000,
    category: 'Электроника',
    status: AdStatus.PUBLISHED,
    daysAgo: 1,
  },
];

// Диалоги без Анны: e2e-тесты проверяют её счётчик непрочитанных
const CHATS: {
  ad: string;
  buyer: UserKey;
  messages: { fromBuyer: boolean; text: string; read: boolean }[];
}[] = [
  {
    ad: 'iphone',
    buyer: 'maria',
    messages: [
      {
        fromBuyer: true,
        text: 'Здравствуйте! iPhone ещё продаётся?',
        read: true,
      },
      { fromBuyer: false, text: 'Добрый день, да, продаётся.', read: true },
      {
        fromBuyer: true,
        text: 'Можно завтра вечером посмотреть?',
        read: false,
      },
    ],
  },
  {
    ad: 'stroller',
    buyer: 'sergey',
    messages: [
      {
        fromBuyer: true,
        text: 'Добрый день! Дождевик тоже отдаёте?',
        read: true,
      },
      {
        fromBuyer: false,
        text: 'Да, всё как на фото, плюс сумка.',
        read: true,
      },
    ],
  },
  {
    ad: 'guitar',
    buyer: 'elena',
    messages: [
      { fromBuyer: true, text: 'Отдадите гитару за 8000?', read: false },
    ],
  },
];

const FAVORITES: { user: UserKey; ad: string }[] = [
  { user: 'maria', ad: 'guitar' },
  { user: 'maria', ad: 'tent' },
  { user: 'ivan', ad: 'flat' },
  { user: 'elena', ad: 'stroller' },
];

const COMPLAINTS: {
  reporter: UserKey;
  ad?: string;
  user?: UserKey;
  reason: ComplaintReason;
  comment: string;
  status: ComplaintStatus;
}[] = [
  {
    reporter: 'ivan',
    ad: 'easy-money',
    reason: ComplaintReason.SPAM,
    comment: 'Это не объявление, а реклама',
    status: ComplaintStatus.OPEN,
  },
  {
    reporter: 'maria',
    ad: 'fake-iphone',
    reason: ComplaintReason.FRAUD,
    comment: 'Цена в разы ниже рынка, просит предоплату',
    status: ComplaintStatus.OPEN,
  },
  {
    reporter: 'sergey',
    user: 'spam',
    reason: ComplaintReason.SPAM,
    comment: 'Пишет всем с предложением заработка',
    status: ComplaintStatus.OPEN,
  },
  {
    reporter: 'elena',
    ad: 'flat',
    reason: ComplaintReason.OTHER,
    comment: 'Кажется, цена завышена',
    status: ComplaintStatus.DISMISSED,
  },
];

function daysAgo(days: number, hours = 0) {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000);
}

type Ids = Record<string, { id: number; authorId: number }>;

async function seedMarket() {
  if (await prisma.user.findUnique({ where: { email: 'ivan@board.local' } })) {
    return;
  }
  const users = await seedPeople();
  const ads = await seedMarketAds(users);
  await seedChats(users, ads);
  await prisma.favorite.createMany({
    data: FAVORITES.map(({ user, ad }) => ({
      userId: users[user],
      adId: ads[ad].id,
    })),
  });
  await seedComplaints(users, ads);
}

async function seedPeople() {
  const moderatorHash = await argon2.hash('moderator123');
  for (const { email, name } of MODERATORS) {
    await prisma.user.create({
      data: { email, name, role: Role.MODERATOR, passwordHash: moderatorHash },
    });
  }

  const userHash = await argon2.hash('demo12345');
  const users = {} as Record<UserKey, number>;
  for (const { key, name } of USERS) {
    const user = await prisma.user.create({
      data: { email: `${key}@board.local`, name, passwordHash: userHash },
    });
    users[key] = user.id;
  }
  return users;
}

async function seedMarketAds(users: Record<UserKey, number>) {
  const ads: Ids = {};
  for (const { key, author, category, daysAgo: days, ...ad } of MARKET_ADS) {
    ads[key] = await prisma.ad.create({
      data: {
        ...ad,
        createdAt: daysAgo(days, 2),
        author: { connect: { id: users[author] } },
        category: { connect: { name: category } },
      },
    });
  }
  return ads;
}

// Сообщения идут по часу друг за другом, последнее — час назад
async function seedChats(users: Record<UserKey, number>, ads: Ids) {
  for (const { ad, buyer, messages } of CHATS) {
    const { id: adId, authorId } = ads[ad];
    const start = messages.length + 1;
    const chat = await prisma.chat.create({
      data: {
        adId,
        buyerId: users[buyer],
        createdAt: daysAgo(0, start),
        updatedAt: daysAgo(0, 1),
      },
    });
    for (const [index, { fromBuyer, text, read }] of messages.entries()) {
      const createdAt = daysAgo(0, start - index - 1);
      await prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: fromBuyer ? users[buyer] : authorId,
          text,
          createdAt,
          readAt: read ? createdAt : null,
        },
      });
    }
  }
}

async function seedComplaints(users: Record<UserKey, number>, ads: Ids) {
  for (const { reporter, ad, user, status, ...complaint } of COMPLAINTS) {
    await prisma.complaint.create({
      data: {
        ...complaint,
        status,
        reporterId: users[reporter],
        adId: ad ? ads[ad].id : null,
        userId: user ? users[user] : null,
        resolvedAt: status === ComplaintStatus.OPEN ? null : daysAgo(0, 3),
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
