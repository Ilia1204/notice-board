import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { mockApi } from './test/mock-api';

describe('App', () => {
  it('отображает название доски объявлений', async () => {
    mockApi({});
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Сбагрим!' }),
    ).toBeInTheDocument();
    // Дожидаемся загрузки главной, иначе ответ придёт после конца теста
    expect(
      await screen.findByText(/Скоро здесь появятся объявления/),
    ).toBeInTheDocument();
  });
});
