import { useMemo } from 'react';
import type { Exercise, Vocab } from '../../content/schema';
import { t } from '../../i18n';
import { conjugationTiles } from '../../session/conjugation-tiles';
import { Prompt } from './Prompt';
import { TileBuilder } from './TileBuilder';

interface Props {
  ex: Extract<Exercise, { type: 'conjugation' }>;
  vocab: readonly Vocab[];
  onChange: (v: string) => void;
  disabled: boolean;
}

export function ConjugationInput({ ex, vocab, onChange, disabled }: Props) {
  const { tokens } = useMemo(() => conjugationTiles(ex, vocab), [ex, vocab]);
  // Aufgabe als Formel: "gelmek · ich · verneint · Frage"
  const formula = [
    ex.lemma,
    t(`person.${ex.person}`),
    ex.mode === 'verb' && ex.tense && ex.tense !== 'present' && t(`tense.${ex.tense}`),
    ex.negative && t('ex.conjugation.negative'),
    ex.question && t('ex.conjugation.question'),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="space-y-4">
      <Prompt instruction={t('ex.conjugation')} text={formula} ex={ex} lang="de" />
      {ex.gloss_de && <p className="-mt-2 text-stone-600 dark:text-stone-400">„{ex.gloss_de}“</p>}
      <TileBuilder
        tokens={tokens}
        joiner=""
        emptyLabel={t('ex.conjugation.empty')}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
