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

/** Formel-Teile für Stamm, Zeit, „können“, Höflichkeit und -dir (gemeinsam mit der Tabelle); „verneint“ ergänzt der Aufrufer. */
export function tenseLabels(
  copula: boolean,
  ex: {
    tense?: string;
    ability?: boolean;
    polite?: boolean;
    passive?: boolean;
    causative?: boolean;
    reciprocal?: boolean;
    dir?: boolean;
    compound?: 'past' | 'evidential' | 'conditional';
  },
): string[] {
  if (copula) {
    const parts =
      ex.tense === 'past' || ex.tense === 'evidential' || ex.tense === 'conditional'
        ? [t(`copula.${ex.tense}`)]
        : [];
    return ex.dir ? [...parts, t('tag.DIR')] : parts;
  }
  const tense = ex.tense as Exclude<typeof ex.tense, undefined>;
  return [
    // Reihenfolge wie im Wort: Kausativ/Reziprok → Passiv → können → Zeit
    ex.causative ? t('tag.CAUS') : '',
    ex.reciprocal ? t('tag.RECIP') : '',
    ex.passive ? t('ex.conjugation.passive') : '',
    ex.ability ? t('ex.conjugation.ability') : '',
    // Mit Kopula oder -dir wird auch das Präsens genannt: „Präsens · mit idi“ (geliyordum).
    tense && (tense !== 'present' || ex.compound || ex.dir) ? t(`tense.${tense as 'past'}`) : '',
    !tense && (ex.compound || ex.dir) ? t('tense.present') : '',
    ex.compound ? t(`compound.${ex.compound}`) : '',
    ex.polite ? t('ex.conjugation.polite') : '',
    ex.dir ? t('tag.DIR') : '',
  ].filter(Boolean);
}

export function ConjugationInput({ ex, vocab, onChange, disabled }: Props) {
  const { tokens } = useMemo(() => conjugationTiles(ex, vocab), [ex, vocab]);
  // Aufgabe als Formel: "gelmek · ich · verneint · Frage"
  const formula = [
    ex.lemma,
    t(`person.${ex.person}`),
    ...tenseLabels(ex.mode === 'copula', ex),
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
