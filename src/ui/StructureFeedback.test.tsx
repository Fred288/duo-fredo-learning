import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Exercise } from '../content/schema';
import { SegmentFeedback } from './StructureFeedback';

afterEach(cleanup);

const waiting: Extract<Exercise, { type: 'segment' }> = {
  id: 'a1-u05-z1-l2-e1',
  type: 'segment',
  word: 'bekliyorum',
  segments: [
    { text: 'bekl', tag: 'STEM' },
    { text: 'iyor', tag: 'PRES' },
    { text: 'um', tag: 'P1SG' },
  ],
  alt_segments: [
    { text: 'bekli', tag: 'STEM' },
    { text: 'yor', tag: 'PRES' },
    { text: 'um', tag: 'P1SG' },
  ],
  analysis: { kind: 'verb', lemma: 'beklemek', person: '1sg' },
  from: 'a1-u05-l2-e1',
};

const pieces = () =>
  screen.getAllByRole('listitem').map((li) => li.querySelector('[lang="tr"]')!.textContent);

describe('SegmentFeedback', () => {
  it('zeigt die Zerlegung der Antwort und erklärt, dass beide üblich sind', () => {
    render(<SegmentFeedback ex={waiting} answer={'bekli|yor|um\n;PRES;P1SG'} />);
    expect(pieces()).toEqual(['bekli', 'yor', 'um']);
    expect(screen.getByText(/Beide Zerlegungen sind üblich/).textContent).toContain(
      'bekl-iyor-um und bekli-yor-um',
    );
  });

  it('ohne Antwort die Zerlegung der Engine; ohne zweite Zerlegung kein Hinweis', () => {
    render(<SegmentFeedback ex={waiting} answer={'bekliyorum\n'} />);
    expect(pieces()).toEqual(['bekl', 'iyor', 'um']);
    cleanup();
    render(
      <SegmentFeedback ex={{ ...waiting, alt_segments: undefined }} answer={'bekliyorum\n'} />,
    );
    expect(screen.queryByText(/Beide Zerlegungen/)).toBeNull();
  });
});
