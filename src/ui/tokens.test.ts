import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Liest die Token-Werte aus `index.css` (ein Block je Thema). */
function tokens(selector: ':root' | '.dark'): Record<string, string> {
  const css = readFileSync('src/index.css', 'utf8');
  const start = css.indexOf(`\n${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
}

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Getönte Flächen: Karten mit Hover, Feedback-Boxen.
const TINTS = [
  'brand-soft',
  'brand-soft-hover',
  'warn-soft',
  'warn-soft-hover',
  'danger-soft',
  'success-soft',
];

// Text (Vordergrund, Hintergründe), mindestens 4,5:1 (WCAG AA).
const TEXT: Record<string, string[]> = {
  ink: ['canvas', 'surface', 'fill-soft', 'fill', 'hover', ...TINTS],
  'ink-muted': ['canvas', 'surface', 'fill-soft', 'hover', ...TINTS],
  'ink-subtle': ['canvas', 'surface', 'fill-soft', 'hover'],
  'brand-ink': ['canvas', 'surface', 'brand-soft', 'brand-soft-hover', 'hover'],
  warn: ['canvas', 'surface'],
  'warn-ink': ['warn-soft', 'warn-soft-hover'],
  danger: ['canvas', 'surface', 'danger-soft'],
  'danger-ink': ['danger-soft'],
  success: ['canvas', 'surface', 'success-soft'],
  'success-ink': ['success-soft'],
  'on-inverse': ['inverse'],
  'on-brand': ['brand', 'brand-strong'],
};

// Bedienelemente und Rahmen von Zuständen: mindestens 3:1 (WCAG 1.4.11).
const UI: Record<string, string[]> = {
  focus: ['canvas', 'surface'],
  'brand-edge': ['canvas', 'surface'],
  'danger-edge': ['canvas', 'surface'],
  'success-edge': ['canvas', 'surface'],
  'brand-bar': ['fill', 'fill-soft'],
};

for (const [name, selector] of [['hell', ':root'], ['dunkel', '.dark']] as const) {
  describe(`Kontrast ${name}`, () => {
    const t = tokens(selector);
    for (const [fg, bgs] of Object.entries(TEXT)) {
      for (const bg of bgs) {
        it(`${fg} auf ${bg} ≥ 4,5`, () => {
          expect(t[fg], fg).toBeDefined();
          expect(t[bg], bg).toBeDefined();
          expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    for (const [fg, bgs] of Object.entries(UI)) {
      for (const bg of bgs) {
        it(`${fg} auf ${bg} ≥ 3`, () => {
          expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(3);
        });
      }
    }
  });
}

it('beide Themen definieren dieselben Tokens', () => {
  expect(Object.keys(tokens('.dark')).sort()).toEqual(Object.keys(tokens(':root')).sort());
});

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [path] : [];
  });
}

it('Komponenten nutzen nur Tokens: keine festen Farben, kein dark:', () => {
  const fixed =
    /\bdark:|\b(?:bg|text|border|divide|decoration|accent|outline)-(?:white|black|stone|teal|amber|rose|red|emerald)\b/;
  expect(sources('src').filter((f) => fixed.test(readFileSync(f, 'utf8')))).toEqual([]);
});
