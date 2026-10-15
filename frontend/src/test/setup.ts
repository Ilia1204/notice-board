import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// без globals: true библиотека не очищает DOM сама
afterEach(() => cleanup());
