import {
  Prisma,
  type Ad,
  type Category,
  type Chat,
  type Favorite,
  type Message,
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
type ChatKey = Pick<Chat, 'adId' | 'buyerId'>;
type ChatWhere = { OR: [{ buyerId: number }, ...unknown[]] };

// Простая замена PrismaService в памяти для интеграционных тестов
export function createPrismaFake() {
  const users: User[] = [];
  const categories: Category[] = [];
  const ads: Ad[] = [];
  const adImages = new Map<number, AdImageRow[]>();
  const favorites: Favorite[] = [];
  const chats: Chat[] = [];
  const messages: Message[] = [];
  // Порядок изменения диалогов: созданные в одну миллисекунду не перепутаются
  const touched = new Map<number, number>();
  let nextCategoryId = 1;
  let nextAdId = 1;
  let nextImageId = 1;
  let nextTouch = 1;

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

  const userRef = (id: number) => ({
    id,
    name: users.find((u) => u.id === id)?.name ?? '',
  });
  const authorOf = (chat: Chat) => findAd(chat.adId).authorId;
  // Как chatInclude в ChatsService: объявление с автором, покупатель и последнее сообщение
  const chatView = (chat: Chat) => {
    const ad = findAd(chat.adId);
    const last = messages.filter((m) => m.chatId === chat.id).at(-1);
    return {
      ...chat,
      ad: { id: ad.id, title: ad.title, author: userRef(ad.authorId) },
      buyer: userRef(chat.buyerId),
      messages: last ? [last] : [],
    };
  };
  const touch = (chat: Chat, updatedAt: Date) => {
    chat.updatedAt = updatedAt;
    touched.set(chat.id, nextTouch++);
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
      update: ({
        where,
        data,
      }: {
        where: Pick<User, 'id'>;
        data: Pick<User, 'name' | 'email'>;
      }) =>
        Promise.resolve().then(() => {
          const user = users.find((u) => u.id === where.id);
          if (!user) throw knownError('P2025');
          if (users.some((u) => u.email === data.email && u !== user)) {
            throw knownError('P2002');
          }
          return Object.assign(user, data);
        }),
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
    chat: {
      findMany: ({ where }: { where: ChatWhere }) => {
        const userId = where.OR[0].buyerId;
        return Promise.resolve(
          chats
            .filter(
              (chat) =>
                (chat.buyerId === userId || authorOf(chat) === userId) &&
                messages.some((m) => m.chatId === chat.id),
            )
            .sort((a, b) => (touched.get(b.id) ?? 0) - (touched.get(a.id) ?? 0))
            .map(chatView),
        );
      },
      findUnique: ({ where }: { where: Pick<Chat, 'id'> }) => {
        const chat = chats.find((c) => c.id === where.id);
        return Promise.resolve(chat ? chatView(chat) : null);
      },
      upsert: ({ create }: { create: ChatKey }) => {
        let chat = chats.find(
          (c) => c.adId === create.adId && c.buyerId === create.buyerId,
        );
        if (!chat) {
          const now = new Date();
          chat = {
            id: chats.length + 1,
            createdAt: now,
            updatedAt: now,
            ...create,
          };
          chats.push(chat);
          touch(chat, now);
        }
        return Promise.resolve(chatView(chat));
      },
      update: ({
        where,
        data,
      }: {
        where: Pick<Chat, 'id'>;
        data: Pick<Chat, 'updatedAt'>;
      }) =>
        Promise.resolve().then(() => {
          const chat = chats.find((c) => c.id === where.id);
          if (!chat) throw knownError('P2025');
          touch(chat, data.updatedAt);
          return chat;
        }),
    },
    message: {
      // Сообщения лежат по порядку отправки
      findMany: ({ where }: { where: Pick<Message, 'chatId'> }) =>
        Promise.resolve(messages.filter((m) => m.chatId === where.chatId)),
      create: ({
        data,
      }: {
        data: Pick<Message, 'chatId' | 'senderId' | 'text'>;
      }) => {
        const message: Message = {
          id: messages.length + 1,
          createdAt: new Date(),
          ...data,
        };
        messages.push(message);
        return Promise.resolve(message);
      },
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
    $disconnect: () => Promise.resolve(),
  };
}
