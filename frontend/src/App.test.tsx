import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('отображает название доски объявлений', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Сбагрим!' }),
    ).toBeInTheDocument();
  });
});
