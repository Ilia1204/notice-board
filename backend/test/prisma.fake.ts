import {
  Prisma,
  type Ad,
  type Category,
  type Favorite,
  type User,
} from '@prisma/client';

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
type AdUpdate = Pick<Ad, 'status'> &
  Partial<Omit<AdData, 'authorId' | 'images'>> & {
    images?: AdData['images'] & { deleteMany: { id: { in: number[] } } };
  };
type AdWhere = Partial<Pick<Ad, 'status' | 'categoryId' | 'authorId'>> & {
  title?: { contains: string };
};
type AdImageRow = { id: number; filename: string; position: number };
type FavoriteKey = Pick<Favorite, 'userId' | 'adId'>;

// Простая замена PrismaService в памяти для интеграционных тестов
export function createPrismaFake() {
  const users: User[] = [];
  const categories: Category[] = [];
  const ads: Ad[] = [];
  const adImages = new Map<number, AdImageRow[]>();
  const favorites: Favorite[] = [];
  let nextCategoryId = 1;
  let nextAdId = 1;
  let nextImageId = 1;

  const withRelations = (ad: Ad) => {
    const category = categories.find((c) => c.id === ad.categoryId);
    const author = users.find((u) => u.id === ad.authorId);
    return {
      ...ad,
      category: { id: ad.categoryId, name: category?.name ?? '' },
      author: { id: ad.authorId, name: author?.name ?? '' },
      images: [...(adImages.get(ad.id) ?? [])].sort(
        (a, b) => a.position - b.position,
      ),
    };
  };

  const toRows = (images: AdData['images']['create']): AdImageRow[] =>
    images.map((image) => ({ id: nextImageId++, ...image }));
  const findAd = (id: number) => {
    const ad = ads.find((a) => a.id === id);
    if (!ad) throw knownError('P2025');
    return ad;
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
                (where.status === undefined || ad.status === where.status) &&
                (where.authorId === undefined ||
                  ad.authorId === where.authorId) &&
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
      findUnique: ({ where }: { where: Pick<Ad, 'id'> }) => {
        const ad = ads.find((a) => a.id === where.id);
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
            id: nextAdId++,
            status: 'PENDING',
            createdAt: now,
            updatedAt: now,
            ...fields,
          };
          ads.push(ad);
          adImages.set(ad.id, toRows(images.create));
          return withRelations(ad);
        }),
      update: ({ where, data }: { where: Pick<Ad, 'id'>; data: AdUpdate }) =>
        Promise.resolve().then(() => {
          const ad = findAd(where.id);
          const { images, ...fields } = data;
          if (
            fields.categoryId !== undefined &&
            !categories.some((c) => c.id === fields.categoryId)
          ) {
            throw knownError('P2003');
          }
          Object.assign(ad, fields, { updatedAt: new Date() });
          if (images) {
            adImages.set(ad.id, [
              ...(adImages.get(ad.id) ?? []).filter(
                (image) => !images.deleteMany.id.in.includes(image.id),
              ),
              ...toRows(images.create),
            ]);
          }
          return withRelations(ad);
        }),
      delete: ({ where }: { where: Pick<Ad, 'id'> }) =>
        Promise.resolve().then(() => {
          const ad = findAd(where.id);
          ads.splice(ads.indexOf(ad), 1);
          adImages.delete(ad.id);
          return ad;
        }),
    },
    favorite: {
      // Записи лежат по порядку добавления, поэтому свежие — с конца
      findMany: ({
        where,
      }: {
        where: Pick<Favorite, 'userId'> & { ad: Pick<Ad, 'status'> };
      }) =>
        Promise.resolve(
          favorites
            .filter(
              (favorite) =>
                favorite.userId === where.userId &&
                findAd(favorite.adId).status === where.ad.status,
            )
            .reverse()
            .map((favorite) => ({
              ...favorite,
              ad: withRelations(findAd(favorite.adId)),
            })),
        ),
      upsert: ({ create }: { create: FavoriteKey }) => {
        const found = favorites.find(
          (f) => f.userId === create.userId && f.adId === create.adId,
        );
        if (found) return Promise.resolve(found);
        const favorite: Favorite = { ...create, createdAt: new Date() };
        favorites.push(favorite);
        return Promise.resolve(favorite);
      },
      deleteMany: ({ where }: { where: FavoriteKey }) => {
        const index = favorites.findIndex(
          (f) => f.userId === where.userId && f.adId === where.adId,
        );
        if (index >= 0) favorites.splice(index, 1);
        return Promise.resolve({ count: index >= 0 ? 1 : 0 });
      },
    },
    $disconnect: () => Promise.resolve(),
  };
}
