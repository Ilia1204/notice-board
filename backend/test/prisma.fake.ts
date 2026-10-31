import { Prisma, type Ad, type Category, type User } from '@prisma/client';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

type CategoryData = Partial<Pick<Category, 'name' | 'description'>>;
type AdData = Pick<
  Ad,
  'title' | 'description' | 'price' | 'categoryId' | 'authorId'
>;

// Простая замена PrismaService в памяти для интеграционных тестов
export function createPrismaFake() {
  const users: User[] = [];
  const categories: Category[] = [];
  const ads: Ad[] = [];
  let nextCategoryId = 1;

  const findCategory = (id: number) => {
    const category = categories.find((c) => c.id === id);
    if (!category) throw knownError('P2025');
    return category;
  };
  const assertUniqueName = (name?: string, exceptId?: number) => {
    if (categories.some((c) => c.name === name && c.id !== exceptId)) {
      throw knownError('P2002');
    }
  };

  return {
    users,
    categories,
    ads,
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
    category: {
      findMany: () =>
        Promise.resolve(
          [...categories].sort((a, b) => a.name.localeCompare(b.name)),
        ),
      create: ({ data }: { data: Required<CategoryData> }) =>
        Promise.resolve().then(() => {
          assertUniqueName(data.name);
          const category: Category = {
            id: nextCategoryId++,
            createdAt: new Date(),
            ...data,
          };
          categories.push(category);
          return category;
        }),
      update: ({
        where,
        data,
      }: {
        where: { id: number };
        data: CategoryData;
      }) =>
        Promise.resolve().then(() => {
          const category = findCategory(where.id);
          assertUniqueName(data.name, where.id);
          if (data.name !== undefined) category.name = data.name;
          if (data.description !== undefined) {
            category.description = data.description;
          }
          return category;
        }),
      delete: ({ where }: { where: { id: number } }) =>
        Promise.resolve().then(() => {
          const category = findCategory(where.id);
          if (ads.some((ad) => ad.categoryId === where.id)) {
            throw knownError('P2003');
          }
          categories.splice(categories.indexOf(category), 1);
          return category;
        }),
    },
    ad: {
      // Как и в базе, вместе с объявлением отдаём категорию и автора
      create: ({ data }: { data: AdData }) =>
        Promise.resolve().then(() => {
          const category = categories.find((c) => c.id === data.categoryId);
          const author = users.find((u) => u.id === data.authorId);
          if (!category) throw knownError('P2003');
          const now = new Date();
          const ad: Ad = {
            id: ads.length + 1,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          ads.push(ad);
          return {
            ...ad,
            category: { id: category.id, name: category.name },
            author: { id: ad.authorId, name: author?.name ?? '' },
          };
        }),
    },
    $disconnect: () => Promise.resolve(),
  };
}
