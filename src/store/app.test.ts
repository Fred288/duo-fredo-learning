import { afterEach, describe, expect, it, vi } from 'vitest';
import { addBackGuard, isFocusScreen, parentOf, useApp } from './app';

const screenName = () => useApp.getState().screen.name;

afterEach(async () => {
  // Verlauf zurück auf „Heute“, damit die Tests einander nicht beeinflussen.
  useApp.getState().goHome();
  await vi.waitFor(() => expect(screenName()).toBe('today'));
});

describe('Verlauf', () => {
  it('Zurück geht zum vorherigen Bildschirm, nicht zu „Heute“', async () => {
    const { openCourse, openLesson, goBack } = useApp.getState();
    openCourse();
    openLesson('a1-u01', 'a1-u01-l1');
    expect(screenName()).toBe('lesson');
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('course'));
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('today'));
  });

  it('derselbe Bildschirm legt keinen zweiten Eintrag an', async () => {
    const { openCourse, goBack } = useApp.getState();
    openCourse();
    openCourse();
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('today'));
  });

  it('Zurück ohne Eintrag davor führt zum Elternbildschirm', () => {
    useApp.setState({ screen: { name: 'review' } });
    // `idx` steht nach den Tests oben wieder bei dem Eintrag „Heute“; hier zählt nur der Rückfall.
    expect(parentOf({ name: 'review' }).name).toBe('settings');
    expect(parentOf({ name: 'explainer', unitId: 'a1-u01', from: 'lookup' }).name).toBe('lookup');
    expect(parentOf({ name: 'explainer', unitId: 'a1-u01' }).name).toBe('course');
    expect(parentOf({ name: 'lesson', unitId: 'a1-u01', lessonId: 'a1-u01-l1' }).name).toBe(
      'course',
    );
    expect(parentOf({ name: 'stats' }).name).toBe('today');
  });

  it('Einstufung übernehmen ersetzt den Eintrag: Zurück führt nicht in den Test zurück', async () => {
    const { openPlacement, goHomeTo, goBack } = useApp.getState();
    openPlacement();
    goHomeTo('a1-u02');
    expect(screenName()).toBe('course');
    expect(useApp.getState().focusUnit).toBe('a1-u02');
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('today'));
  });
});

describe('Zurück-Wächter', () => {
  it('fängt Zurück ab: der Wächter handelt, der Bildschirm bleibt', async () => {
    const { openCourse, openLookup, goBack } = useApp.getState();
    openCourse();
    openLookup();
    const handler = vi.fn();
    const remove = addBackGuard(handler);
    goBack();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(screenName()).toBe('lookup');

    // Ohne Wächter geht Zurück wieder normal.
    remove();
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('course'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('der Verlauf bleibt nach dem Abfangen intakt', async () => {
    const { openCourse, openLookup, goBack } = useApp.getState();
    openCourse();
    openLookup();
    const remove = addBackGuard(() => undefined);
    goBack();
    // Der abgefangene Schritt wird mit „Vorwärts“ zurückgenommen; Ruhe abwarten.
    await new Promise((r) => setTimeout(r, 50));
    remove();
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('course'));
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('today'));
  });
});

describe('Fokusbereiche', () => {
  it('Lektion, Wiederholen, Fehler und Einstufung blenden die Navigation aus', () => {
    for (const name of ['lesson', 'repeat', 'mistakes', 'placement'] as const) {
      expect(
        isFocusScreen(name === 'lesson' ? { name, unitId: 'u', lessonId: 'l' } : { name }),
      ).toBe(true);
    }
    for (const name of [
      'today',
      'course',
      'more',
      'settings',
      'stats',
      'lookup',
      'review',
    ] as const) {
      expect(isFocusScreen({ name })).toBe(false);
    }
  });
});
