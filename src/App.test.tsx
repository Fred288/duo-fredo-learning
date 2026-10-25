import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from './App';

it('zeigt den Titel', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Yol' })).toBeTruthy();
});
