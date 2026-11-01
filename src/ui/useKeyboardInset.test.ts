import { describe, expect, it } from 'vitest';
import { keyboardInset } from './useKeyboardInset';

const vv = (height: number, offsetTop = 0, scale = 1) => ({ height, offsetTop, scale });

describe('keyboardInset', () => {
  it('ohne Tastatur: 0', () => {
    expect(keyboardInset(844, vv(844))).toBe(0);
  });

  it('iOS: sichtbarer Bereich kleiner als der Layout-Viewport', () => {
    expect(keyboardInset(844, vv(520))).toBe(324);
  });

  it('der Versatz des sichtbaren Bereichs zählt mit', () => {
    expect(keyboardInset(844, vv(520, 40))).toBe(284);
  });

  it('Chrome auf Android verkleinert den Layout-Viewport selbst: 0', () => {
    expect(keyboardInset(520, vv(520))).toBe(0);
  });

  it('Zoomen ist keine Tastatur', () => {
    expect(keyboardInset(844, vv(400, 0, 2.1))).toBe(0);
  });

  it('ohne Visual-Viewport-API: 0', () => {
    expect(keyboardInset(844, undefined)).toBe(0);
  });

  it('nie negativ', () => {
    expect(keyboardInset(800, vv(820))).toBe(0);
  });
});
