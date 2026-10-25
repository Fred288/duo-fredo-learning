import { useMemo } from 'react';
import type { Exercise } from '../../content/schema';
import { t } from '../../i18n';
import { wordBankTokens } from '../../session/grade';
import { Prompt } from './Prompt';
import { TileBuilder } from './TileBuilder';

interface Props {
  ex: Extract<Exercise, { type: 'word_bank' }>;
  onChange: (v: string) => void;
  disabled: boolean;
}

export function WordBankInput({ ex, onChange, disabled }: Props) {
  const tokens = useMemo(() => wordBankTokens(ex), [ex]);
  return (
    <div className="space-y-4">
      <Prompt instruction={t('ex.word_bank')} text={ex.prompt} ex={ex} lang="de" />
      <TileBuilder
        tokens={tokens}
        joiner=" "
        emptyLabel={t('ex.word_bank.empty')}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
