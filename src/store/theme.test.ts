import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.documentElement.classList.remove('dark');
  document.head.innerHTML = '';
});

/** Gefälschte Systemeinstellung; `flip` löst den Wechsel im Betriebssystem aus. */
function fakeSystem(dark: boolean) {
  const listeners: (() => void)[] = [];
  const query = {
    matches: dark,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    flip(next: boolean) {
      query.matches = next;
      listeners.forEach((fn) => fn());
    },
  };
}

function themeColor() {
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  document.head.append(meta);
  return meta;
}

it('„System“ folgt einem Wechsel im Betriebssystem samt theme-color', async () => {
  const system = fakeSystem(false);
  const meta = themeColor();
  await import('./settings');

  system.flip(true);
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(meta.content).toBe('#0c0a09');

  system.flip(false);
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(meta.content).toBe('#fafaf9');
});

it('eine feste Wahl ignoriert das Betriebssystem', async () => {
  const system = fakeSystem(false);
  const { useSettings } = await import('./settings');
  useSettings.getState().set('theme', 'light');

  system.flip(true);
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
