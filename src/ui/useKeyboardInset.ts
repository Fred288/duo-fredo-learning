import { useEffect } from 'react';

interface VisualViewportLike {
  height: number;
  offsetTop: number;
  scale: number;
}

/**
 * Höhe, die die Bildschirmtastatur vom Layout-Viewport verdeckt. Chrome auf Android verkleinert den
 * Layout-Viewport selbst (`interactive-widget=resizes-content`), dort ist das Ergebnis 0; iOS
 * verkleinert nur den sichtbaren Bereich. Beim Zoomen schrumpft der sichtbare Bereich ebenfalls,
 * das ist keine Tastatur.
 */
export function keyboardInset(innerHeight: number, vv?: VisualViewportLike): number {
  if (!vv || vv.scale > 1.01) return 0;
  return Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
}

/** Setzt `--keyboard-inset`, damit klebende Leisten über der Tastatur stehen. */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty('--keyboard-inset', `${keyboardInset(window.innerHeight, vv)}px`);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
