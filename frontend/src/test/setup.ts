import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetFakeSocket } from './fake-socket';

// Настоящего сервера в тестах нет — WebSocket подменяем
vi.mock('socket.io-client', () => import('./fake-socket'));

// без globals: true библиотека не очищает DOM сама
afterEach(() => {
  cleanup();
  resetFakeSocket();
});
