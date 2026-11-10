import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetFakeSocket } from './fake-socket';

// Настоящего сервера в тестах нет — WebSocket подменяем
vi.mock('socket.io-client', () => import('./fake-socket'));

// При параллельном прогоне 1 секунды на findBy/waitFor иногда не хватает
configure({ asyncUtilTimeout: 3000 });

// без globals: true библиотека не очищает DOM сама
afterEach(() => {
  cleanup();
  resetFakeSocket();
});
