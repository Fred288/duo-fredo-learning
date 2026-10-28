import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../../content/schema';
import { SegmentInput } from './SegmentInput';

afterEach(cleanup);

const ex = {
  id: 'a1-u02-z1-v1',
  type: 'segment',
  word: 'evlerde',
  segments: [
    { text: 'ev', tag: 'STEM' },
    { text: 'ler', tag: 'PL' },
    { text: 'de', tag: 'LOC' },
  ],
  analysis: { kind: 'noun', stem: 'ev', tags: ['PL', 'LOC'] },
} as unknown as Extract<Exercise, { type: 'segment' }>;

describe('SegmentInput: Tastaturbedienung', () => {
  it('nur ein Buchstabe ist Tab-Halt, Pfeiltasten wechseln', () => {
    render(<SegmentInput ex={ex} onChange={() => {}} disabled={false} />);
    const cut = screen.getAllByRole('button');
    expect(cut.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(cut[0]!.tabIndex).toBe(0);
    cut[0]!.focus();
    fireEvent.keyDown(cut[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cut[1]);
    expect(cut[1]!.tabIndex).toBe(0);
    expect(cut[0]!.tabIndex).toBe(-1);
    fireEvent.keyDown(cut[1]!, { key: 'End' });
    expect(document.activeElement).toBe(cut[cut.length - 1]);
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(cut[0]);
  });

  it('kündigt neue Teile an', () => {
    const onChange = vi.fn();
    const { container } = render(<SegmentInput ex={ex} onChange={onChange} disabled={false} />);
    const live = container.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Grenze nach „ev“' }));
    expect(live.textContent).toBe('Teile: ev, lerde');
  });
});
