/**
 * Sprechbarer Text aus einem Inhaltsstring: ohne Klammerzusätze, ohne Suffix-Notation
 * (-de, -ler), bei Alternativen „a / b“ nur die erste. undefined, wenn nichts übrig bleibt.
 */
export function speechText(text: string): string | undefined {
  const first = text.split('/')[0]!;
  const words = first
    .replace(/\([^)]*\)/g, ' ')
    .replace(/…|\.\.\./g, ' ')
    .split(/\s+/)
    .filter((w) => w && !w.startsWith('-') && !w.endsWith('-'));
  const out = words.join(' ').trim();
  return /\p{L}/u.test(out) ? out : undefined;
}
