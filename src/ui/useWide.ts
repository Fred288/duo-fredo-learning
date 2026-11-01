import { useSyncExternalStore } from 'react';

/** Ab dieser Breite (Tailwind `lg`) stehen Kurs und Unit nebeneinander. */
const WIDE = '(min-width: 1024px)';

const query = () => (typeof window === 'undefined' ? undefined : window.matchMedia?.(WIDE));

function subscribe(onChange: () => void): () => void {
  const q = query();
  q?.addEventListener?.('change', onChange);
  return () => q?.removeEventListener?.('change', onChange);
}

/** Ob das Fenster breit genug für zwei Spalten ist; ohne `matchMedia` (Tests) schmal. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false,
  );
}
