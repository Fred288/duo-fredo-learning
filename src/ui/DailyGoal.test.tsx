import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Completion } from '../progress/stats';
import { useProgress } from '../store/progress';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { DailyGoal } from './DailyGoal';

const c = (day: string): Completion => ({
  lessonId: 'a1-u01-l1',
  unitId: 'a1-u01',
  correct: 1,
  total: 1,
  at: 0,
  day,
});

beforeEach(() => {
  // Dienstag, 10. November 2026: Woche ab Montag, 9. November; November hat 30 Tage.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 10, 12));
  useSettings.setState({ ...DEFAULT_SETTINGS, dailyGoal: 2 });
  useProgress.setState({
    completions: [c('2026-11-10'), c('2026-11-09'), c('2026-11-08'), c('2026-10-31')],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('zeigt Tages-, Wochen- und Monatsziel, abgeleitet aus dem Tagesziel', () => {
  render(<DailyGoal />);
  expect(screen.getByRole('progressbar', { name: 'Heute: 1 von 2 Lektionen' })).toBeTruthy();
  // Sonntag, 8. November, gehört zur Vorwoche, aber zum Monat; der 31. Oktober zu keinem.
  const week = screen.getByRole('progressbar', { name: 'Diese Woche: 2 von 14 Lektionen' });
  expect(week.getAttribute('aria-valuemax')).toBe('14');
  expect(screen.getByRole('progressbar', { name: 'Diesen Monat: 3 von 60 Lektionen' })).toBeTruthy();
});

it('meldet erreichte Ziele ohne Zahl darüber hinaus', () => {
  useSettings.setState({ dailyGoal: 1 });
  useProgress.setState({
    completions: [...Array.from({ length: 7 }, () => c('2026-11-10')), c('2026-11-02')],
  });
  render(<DailyGoal />);
  expect(screen.getByText('Tagesziel erreicht')).toBeTruthy();
  expect(screen.getByText('Wochenziel erreicht')).toBeTruthy();
  expect(screen.getByText('Diesen Monat: 8 von 30 Lektionen')).toBeTruthy();
  // Der Balken bleibt beim Ziel stehen.
  expect(screen.getByRole('progressbar', { name: 'Heute: 1 von 1 Lektionen' })).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Diese Woche: 7 von 7 Lektionen' })).toBeTruthy();
});

it('blendet Woche und Monat über die Einstellung aus', () => {
  useSettings.setState({ showPeriodGoals: false });
  render(<DailyGoal />);
  expect(screen.getAllByRole('progressbar')).toHaveLength(1);
});
