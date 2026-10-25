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
  // Aufgabe als Formel: "ev + Plural + Lokativ", Deutsch als Kontext.
  const formula = [ex.stem, ...ex.suffixes.map((tag) => t(`tag.${tag}`))].join(' + ');
  return (
    <div className="space-y-4">
      <Prompt instruction={t('ex.suffix_builder')} text={formula} ex={ex} lang="de" />
      {ex.gloss_de && <p className="-mt-2 text-stone-600 dark:text-stone-400">„{ex.gloss_de}“</p>}
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
