import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { App } from './App';
import { useApp } from './store/app';

afterEach(() => {
  cleanup();
  useApp.setState({ screen: { name: 'home' } });
});

it('zeigt den Titel', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Yol' })).toBeTruthy();
});

it('Taste „/“ öffnet das Nachschlagewerk, nicht beim Tippen in einem Feld', () => {
  render(<App />);
  const field = document.createElement('input');
  document.body.append(field);
  fireEvent.keyDown(field, { key: '/' });
  expect(useApp.getState().screen.name).toBe('home');
  field.remove();

  fireEvent.keyDown(window, { key: '/', ctrlKey: true });
  expect(useApp.getState().screen.name).toBe('home');
  fireEvent.keyDown(window, { key: '/' });
  expect(useApp.getState().screen.name).toBe('lookup');
});
