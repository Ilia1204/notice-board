// У каждого пользователя своя комната Socket.IO: так событие дойдёт во все его вкладки
export const userRoom = (userId: number) => `user:${userId}`;
