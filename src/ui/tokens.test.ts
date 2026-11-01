import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Liest die Token-Werte aus `index.css` (ein Block je Thema). */
function tokens(selector: ':root' | '.dark'): Record<string, string> {
  const css = readFileSync('src/index.css', 'utf8');
  const start = css.indexOf(`\n${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Der Seitenuntergrund: Fokusbereiche `canvas`, Navigationsbereiche der feste Verlauf.
const PAGE = ['canvas', 'bg-1', 'bg-2'];

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
  ink: [...PAGE, 'surface', 'fill-soft', 'fill', 'hover', ...TINTS],
  'ink-muted': [...PAGE, 'surface', 'fill-soft', 'fill', 'hover', ...TINTS],
  'ink-subtle': [...PAGE, 'surface', 'fill-soft', 'fill', 'hover'],
  'brand-ink': [...PAGE, 'surface', 'brand-soft', 'brand-soft-hover', 'hover'],
  warn: [...PAGE, 'surface'],
  'warn-ink': ['warn-soft', 'warn-soft-hover'],
  danger: [...PAGE, 'surface', 'danger-soft'],
  'danger-ink': ['danger-soft'],
  success: [...PAGE, 'surface', 'success-soft'],
  'success-ink': ['success-soft'],
  'on-inverse': ['inverse'],
  'on-brand': ['brand', 'brand-strong'],
};

// Bedienelemente und Rahmen von Zuständen: mindestens 3:1 (WCAG 1.4.11).
const UI: Record<string, string[]> = {
  focus: [...PAGE, 'surface'],
  'brand-edge': [...PAGE, 'surface'],
  'danger-edge': ['canvas', 'surface'],
  'success-edge': ['canvas', 'surface'],
  'brand-bar': ['fill', 'fill-soft'],
};

for (const [name, selector] of [
  ['hell', ':root'],
  ['dunkel', '.dark'],
] as const) {
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

/** Zahlen-Tokens (Deckkraft) eines Themas. */
function numbers(selector: ':root' | '.dark'): Record<string, number> {
  const css = readFileSync('src/index.css', 'utf8');
  const start = css.indexOf(`
${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([0-9.]+);/g)].map((m) => [m[1]!, Number(m[2])]),
  );
}

/** Glasfläche über einem Untergrund: `alpha` Grundfarbe, der Rest scheint durch. */
export function over(base: string, alpha: number, back: string): string {
  const mix = (shift: number) => {
    const b = (parseInt(base.slice(1), 16) >> shift) & 255;
    const k = (parseInt(back.slice(1), 16) >> shift) & 255;
    return Math.round(alpha * b + (1 - alpha) * k);
  };
  return `#${((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, '0')}`;
}

// Glas lässt den Untergrund durchscheinen; der Text muss über dem ungünstigsten halten: den
// Hintergrundtönen, der Fläche selbst und dem Text, der darunter vorbeiläuft (der Gegenpol der
// Grundfarbe: dunkle Schrift unter hellem Glas, helle unter dunklem).
const GLASS: Record<string, { alpha: string; fg: string[]; back: string[] }> = {
  glass: {
    alpha: 'glass-alpha',
    fg: ['ink', 'ink-muted', 'brand-ink'],
    back: ['canvas', 'bg-1', 'bg-2', 'surface', 'ink', 'ink-muted'],
  },
  'glass-strong': {
    alpha: 'glass-alpha-strong',
    fg: ['ink', 'ink-muted', 'ink-subtle', 'brand-ink'],
    back: ['canvas', 'bg-1', 'bg-2', 'surface', 'ink', 'ink-muted'],
  },
  card: {
    alpha: 'card-alpha',
    fg: ['ink', 'ink-muted', 'ink-subtle', 'brand-ink'],
    back: ['canvas', 'bg-1', 'bg-2', 'surface'],
  },
};

for (const [name, selector] of [
  ['hell', ':root'],
  ['dunkel', '.dark'],
] as const) {
  describe(`Glas ${name}`, () => {
    const t = tokens(selector);
    const n = numbers(selector);
    for (const [cls, { alpha, fg, back }] of Object.entries(GLASS)) {
      for (const f of fg) {
        for (const b of back) {
          it(`${f} auf .${cls} über ${b} ≥ 4,5`, () => {
            const bg = over(t['glass-base']!, n[alpha]!, t[b]!);
            expect(contrast(t[f]!, bg)).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
    }
    for (const [cls, { alpha, back }] of Object.entries(GLASS)) {
      for (const b of back) {
        it(`Fokusring auf .${cls} über ${b} ≥ 3`, () => {
          expect(
            contrast(t.focus!, over(t['glass-base']!, n[alpha]!, t[b]!)),
          ).toBeGreaterThanOrEqual(3);
        });
      }
    }
    it('Glasfarbe gibt es als Hex und als RGB-Tripel, beide gleich', () => {
      const css = readFileSync('src/index.css', 'utf8');
      const start = css.indexOf(`\n${selector} {`);
      const rgb = /--glass-rgb:\s*(\d+) (\d+) (\d+)/.exec(css.slice(start))!;
      const hex = rgb.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, '0'));
      expect(`#${hex.join('')}`).toBe(t['glass-base']);
    });
    it('Deckkräfte liegen zwischen 0 und 1, das Glas der Sheets ist dichter', () => {
      expect(n['glass-alpha']).toBeGreaterThan(0.5);
      expect(n['glass-alpha-strong']).toBeGreaterThan(n['glass-alpha']!);
      expect(n['glass-alpha-strong']).toBeLessThanOrEqual(1);
    });
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
