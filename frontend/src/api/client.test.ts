import { describe, expect, it } from 'vitest';
import { API_URL } from './client';

describe('API_URL', () => {
  it('по умолчанию указывает на локальный backend', () => {
    expect(API_URL).toBe('http://localhost:3000');
  });
});
