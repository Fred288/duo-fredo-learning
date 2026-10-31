import { useMemo } from 'react';
import type { Exercise, Vocab } from '../../content/schema';
import { t } from '../../i18n';
import { suffixTiles } from '../../session/suffix-tiles';
import { Prompt } from './Prompt';
import { TileBuilder } from './TileBuilder';

interface Props {
  ex: Extract<Exercise, { type: 'suffix_builder' }>;
  vocab: readonly Vocab[];
  onChange: (v: string) => void;
  disabled: boolean;
}

export function SuffixBuilderInput({ ex, vocab, onChange, disabled }: Props) {
  const { tokens } = useMemo(() => suffixTiles(ex, vocab), [ex, vocab]);
  // Aufgabe als Formel: "ev + Plural + Lokativ", "okumak + Partizip -dik + mein", Deutsch als Kontext.
  const formula = [
    ex.stem,
    ex.causative && t('tag.CAUS'),
    ex.reciprocal && t('tag.RECIP'),
    ex.passive && t('tag.PASS'),
    // verneintes Können ist -(y)AmA, nicht -ebil + -me (gelemeyen)
    ex.ability && t(ex.negative ? 'tag.ABIL_NEG' : 'tag.ABIL'),
    ex.negative && !ex.ability && t('tag.NEG'),
    ex.verbal && t(`tag.${ex.verbal}`),
    ...ex.suffixes.map((tag) => t(`tag.${tag}`)),
  ]
    .filter(Boolean)
    .join(' + ');
  return (
    <div className="space-y-4">
      <Prompt instruction={t('ex.suffix_builder')} text={formula} ex={ex} lang="de" />
      {ex.gloss_de && <p className="-mt-2 text-ink-muted">„{ex.gloss_de}“</p>}
      <TileBuilder
        tokens={tokens}
        joiner=""
        emptyLabel={t('ex.suffix_builder.empty')}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
