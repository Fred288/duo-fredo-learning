import { afterEach, describe, expect, it, vi } from 'vitest';
import { addBackGuard, isFocusScreen, parentOf, useApp } from './app';

const screenName = () => useApp.getState().screen.name;

afterEach(async () => {
  // Verlauf zurück auf „Heute“, damit die Tests einander nicht beeinflussen.
  useApp.getState().openToday();
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

  it('Elternbildschirme', () => {
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

describe('eigene Zurück-Schritte', () => {
  it('Doppeltippen geht nur einen Schritt zurück', async () => {
    const { openCourse, openStats, openSettings, goBack } = useApp.getState();
    openCourse();
    openStats();
    openSettings();
    goBack();
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('stats'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screenName()).toBe('stats');
  });

  it('Knöpfe gehen am Wächter vorbei, die Zurück-Taste nicht', async () => {
    const { openCourse, openLookup, goBack } = useApp.getState();
    openCourse();
    openLookup();
    const handler = vi.fn();
    const remove = addBackGuard(handler);
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('course'));
    expect(handler).not.toHaveBeenCalled();
    remove();
  });

  it('jede Navigation löscht ein offenes Scrollziel', async () => {
    const { openCourse, openStats, goHomeTo, openToday } = useApp.getState();
    openCourse();
    openStats();
    goHomeTo('a1-u02');
    expect(useApp.getState().focusUnit).toBe('a1-u02');
    openToday();
    expect(useApp.getState().focusUnit).toBeUndefined();
  });
});

describe('Zurück-Wächter', () => {
  it('fängt Zurück ab: der Wächter handelt, der Bildschirm bleibt', async () => {
    const { openCourse, openLookup, goBack } = useApp.getState();
    openCourse();
    openLookup();
    const handler = vi.fn();
    const remove = addBackGuard(handler);
    window.history.back();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(screenName()).toBe('lookup');
    await new Promise((r) => setTimeout(r, 50));

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
    window.history.back();
    // Der abgefangene Schritt wird mit „Vorwärts“ zurückgenommen; Ruhe abwarten.
    await new Promise((r) => setTimeout(r, 50));
    remove();
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('course'));
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('today'));
  });
});

describe('abgefangene Schritte', () => {
  it('nimmt auch mehrere Schritte auf einmal zurück', async () => {
    const { openCourse, openStats, openLookup, goBack } = useApp.getState();
    openCourse();
    openStats();
    openLookup();
    const handler = vi.fn();
    const remove = addBackGuard(handler);
    window.history.go(-2);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    remove();
    goBack();
    await vi.waitFor(() => expect(screenName()).toBe('stats'));
  });

  it('eine Navigation während der Rücknahme lässt nichts hängen', async () => {
    const { openCourse, openLookup, openStats, goBack } = useApp.getState();
    openCourse();
    openLookup();
    const remove = addBackGuard(() => openStats());
    window.history.back();
    await vi.waitFor(() => expect(screenName()).toBe('stats'));
    remove();
    await new Promise((r) => setTimeout(r, 50));
    goBack();
    await vi.waitFor(() => expect(screenName()).not.toBe('stats'));
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
