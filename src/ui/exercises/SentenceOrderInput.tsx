import { useMemo } from 'react';
import type { Exercise } from '../../content/schema';
import { t } from '../../i18n';
import { ORDER_JOINER, orderTokens } from '../../session/word-order';
import { Prompt } from './Prompt';
import { TileBuilder } from './TileBuilder';

interface Props {
  ex: Extract<Exercise, { type: 'sov_puzzle' }>;
  onChange: (answer: string) => void;
  disabled: boolean;
}

/** Satzbau: Satzglieder (nicht Wörter) in türkische Reihenfolge bringen, ohne Ablenker. */
export function SentenceOrderInput({ ex, onChange, disabled }: Props) {
  const tokens = useMemo(() => orderTokens(ex), [ex]);
  return (
    <div className="space-y-4">
      <Prompt instruction={t('ex.sov_puzzle')} text={ex.prompt} ex={ex} lang="de" />
      <TileBuilder
        tokens={tokens}
        joiner={ORDER_JOINER}
        emptyLabel={t('ex.sov_puzzle.empty')}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
