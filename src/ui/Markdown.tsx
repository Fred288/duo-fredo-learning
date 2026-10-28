import { Fragment, type ReactNode } from 'react';
import { sectionSlug } from '../content/explainer-section';

// Kleines Markdown-Subset für Erklärkarten: #-Überschriften, Absätze, - Listen,
// Pipe-Tabellen, **fett**, `code`. Es werden nur React-Elemente gebaut, nie HTML.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded bg-stone-200 px-1 dark:bg-stone-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const isTableStart = (lines: string[], i: number) =>
  (lines[i] ?? '').trim().startsWith('|') &&
  /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test((lines[i + 1] ?? '').trim());

const HEADING_CLASS = [
  '',
  'mt-2 text-2xl font-semibold',
  'mt-6 text-xl font-semibold',
  'mt-4 text-lg font-medium',
];

export function Markdown({ source }: { source: string }) {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const at = (n: number) => lines[n] ?? '';
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = at(i);
    const key = blocks.length;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!line.trim()) {
      i++;
    } else if (heading) {
      const level = (heading[1] ?? '#').length;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      blocks.push(
        <Tag
          key={key}
          id={level === 2 ? `sec-${sectionSlug(heading[2] ?? '')}` : undefined}
          tabIndex={level === 2 ? -1 : undefined}
          className={`${HEADING_CLASS[level] ?? ''} scroll-mt-4 outline-none`}
        >
          {inline(heading[2] ?? '')}
        </Tag>,
      );
      i++;
    } else if (isTableStart(lines, i)) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && at(i).trim().startsWith('|')) rows.push(splitRow(at(i++)));
      blocks.push(
        <div
          key={key}
          className="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-800"
        >
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="bg-stone-100 dark:bg-stone-800">
              <tr>
                {head.map((c, j) => (
                  <th key={j} scope="col" className="px-3 py-2 font-medium">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-stone-200 dark:border-stone-800">
                  {head.map((_, j) => (
                    <td key={j} className="px-3 py-2 align-top">
                      {inline(row[j] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(at(i)))
        items.push(at(i++).replace(/^\s*-\s+/, ''));
      blocks.push(
        <ul key={key} className="list-disc space-y-1 pl-5">
          {items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </ul>,
      );
    } else {
      const para: string[] = [];
      while (
        i < lines.length &&
        at(i).trim() &&
        !/^(#{1,3}\s|\s*-\s+)/.test(at(i)) &&
        !isTableStart(lines, i)
      ) {
        para.push(at(i++).trim());
      }
      blocks.push(<p key={key}>{inline(para.join(' '))}</p>);
    }
  }
  return <div className="space-y-3 leading-relaxed">{blocks}</div>;
}
