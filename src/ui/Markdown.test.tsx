import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

afterEach(cleanup);

describe('Markdown', () => {
  it('rendert Überschriften und Absätze', () => {
    render(<Markdown source={'# Titel\n\nZeile eins\nZeile zwei\n\n## Unter'} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Titel' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Unter' })).toBeTruthy();
    expect(screen.getByText('Zeile eins Zeile zwei')).toBeTruthy();
  });

  it('rendert Listen', () => {
    render(<Markdown source={'- eins\n- zwei'} />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['eins', 'zwei']);
  });

  it('rendert Tabellen mit Kopfzeile', () => {
    render(<Markdown source={'| A | B |\n| --- | --- |\n| ç | çay |\n| ş | şehir |'} />);
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['A', 'B']);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: 'şehir' })).toBeTruthy();
  });

  it('rendert fett und code', () => {
    const { container } = render(<Markdown source={'Das ist **wichtig** und `I` ist `ı`.'} />);
    expect(container.querySelector('strong')?.textContent).toBe('wichtig');
    expect([...container.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['I', 'ı']);
  });

  it('erzeugt aus HTML keine Elemente', () => {
    const { container } = render(
      <Markdown source={'<img src=x onerror=alert(1)> **<b>x</b>**\n\n- <script>y</script>'} />,
    );
    expect(container.querySelector('img, b, script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
