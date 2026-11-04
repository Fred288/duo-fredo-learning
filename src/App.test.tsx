import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { App } from './App';
import { useApp } from './store/app';

afterEach(() => {
  cleanup();
  useApp.setState({ screen: { name: 'today' } });
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
  expect(useApp.getState().screen.name).toBe('today');
  field.remove();

  fireEvent.keyDown(window, { key: '/', ctrlKey: true });
  expect(useApp.getState().screen.name).toBe('today');
  fireEvent.keyDown(window, { key: '/' });
  expect(useApp.getState().screen.name).toBe('lookup');
});

it('Navigation: vier Ziele plus Karteikasten, Statistik und Einstellungen, das aktuelle ist markiert', () => {
  render(<App />);
  const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
  const names = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent);
  expect(names).toEqual([
    'Heute',
    'Kurs',
    'Nachschlagen',
    'Karteikasten',
    'Statistik',
    'Einstellungen',
    'Mehr',
  ]);
  const current = nav.querySelectorAll('[aria-current="page"]');
  expect(current).toHaveLength(1);
  expect(current[0]?.textContent).toBe('Heute');

  fireEvent.click(screen.getByRole('button', { name: 'Kurs' }));
  expect(useApp.getState().screen.name).toBe('course');
  expect(screen.getByRole('button', { name: 'Kurs' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('heading', { name: 'Kurs', level: 1 })).toBeTruthy();
});

it('Mehr führt zu Statistik und Einstellungen', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
  expect(screen.getByRole('heading', { name: 'Mehr', level: 1 })).toBeTruthy();
  const main = screen.getByRole('main');
  fireEvent.click(within(main).getByRole('button', { name: /Einstellungen/ }));
  expect(useApp.getState().screen.name).toBe('settings');
  // Unter „Mehr“ bleibt das Ziel in der Leiste markiert.
  expect(screen.getByRole('button', { name: 'Mehr' }).getAttribute('aria-current')).toBe('page');
});

it('Fokusbereiche blenden die Navigation aus, „/“ gilt dort nicht', () => {
  useApp.setState({ screen: { name: 'repeat' } });
  render(<App />);
  expect(screen.queryByRole('navigation')).toBeNull();
  fireEvent.keyDown(window, { key: '/' });
  expect(useApp.getState().screen.name).toBe('repeat');
});

it('beim Bildschirmwechsel bekommt die Überschrift den Fokus', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Kurs' }));
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Kurs', level: 1 }));
});

it('Skip-Link setzt den Fokus auf den Inhalt, ohne die Adresse zu ändern', () => {
  render(<App />);
  const before = window.location.href;
  fireEvent.click(screen.getByText('Zum Inhalt springen'));
  expect(document.activeElement).toBe(screen.getByRole('main'));
  expect(window.location.href).toBe(before);
});
