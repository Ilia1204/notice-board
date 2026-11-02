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
> & { images: { create: { filename: string; position: number }[] } };
type AdWhere = Pick<Ad, 'status'> &
  Partial<Pick<Ad, 'categoryId'>> & { title?: { contains: string } };

// Простая замена PrismaService в памяти для интеграционных тестов
export function createPrismaFake() {
  const users: User[] = [];
  const categories: Category[] = [];
  const ads: Ad[] = [];
  const adImages = new Map<number, { filename: string }[]>();
  let nextCategoryId = 1;

  const withRelations = (ad: Ad) => {
    const category = categories.find((c) => c.id === ad.categoryId);
    const author = users.find((u) => u.id === ad.authorId);
    return {
      ...ad,
      category: { id: ad.categoryId, name: category?.name ?? '' },
      author: { id: ad.authorId, name: author?.name ?? '' },
      images: (adImages.get(ad.id) ?? []).map((image, i) => ({
        id: i + 1,
        filename: image.filename,
      })),
    };
  };

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
      // Как и в базе, вместе с объявлением отдаём категорию, автора и фото
      findMany: ({ where }: { where: AdWhere }) =>
        Promise.resolve(
          ads
            .filter(
              (ad) =>
                ad.status === where.status &&
                (where.categoryId === undefined ||
                  ad.categoryId === where.categoryId) &&
                (!where.title ||
                  ad.title
                    .toLowerCase()
                    .includes(where.title.contains.toLowerCase())),
            )
            // Созданные в одну миллисекунду упорядочиваем по id
            .sort(
              (a, b) =>
                b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
            )
            .map(withRelations),
        ),
      findFirst: ({ where }: { where: Pick<Ad, 'id' | 'status'> }) => {
        const ad = ads.find(
          (a) => a.id === where.id && a.status === where.status,
        );
        return Promise.resolve(ad ? withRelations(ad) : null);
      },
      create: ({ data }: { data: AdData }) =>
        Promise.resolve().then(() => {
          const { images, ...fields } = data;
          if (!categories.some((c) => c.id === fields.categoryId)) {
            throw knownError('P2003');
          }
          const now = new Date();
          const ad: Ad = {
            id: ads.length + 1,
            status: 'PENDING',
            createdAt: now,
            updatedAt: now,
            ...fields,
          };
          ads.push(ad);
          adImages.set(ad.id, images.create);
          return withRelations(ad);
        }),
    },
    $disconnect: () => Promise.resolve(),
  };
}
