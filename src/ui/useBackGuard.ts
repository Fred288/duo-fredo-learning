import { useEffect, useRef } from 'react';
import { addBackGuard } from '../store/app';

/**
 * Solange `active`, löst die Zurück-Taste des Geräts `onBack` aus, statt den Bildschirm zu wechseln
 * (Sheet schließen, Eintrag zur Liste, Abbruch-Rückfrage). Der Verlauf bleibt dabei unberührt.
 */
export function useBackGuard(active: boolean, onBack: () => void): void {
  const handler = useRef(onBack);
  useEffect(() => {
    handler.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    return addBackGuard(() => handler.current());
  }, [active]);
}
