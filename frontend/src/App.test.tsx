import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('отображает заголовок доски объявлений', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Доска объявлений' }),
    ).toBeInTheDocument();
  });
});
