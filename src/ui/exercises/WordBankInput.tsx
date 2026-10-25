import { useEffect, useMemo, useState } from 'react';
import type { Exercise } from '../../content/schema';
import { t } from '../../i18n';
import { wordBankTokens } from '../../session/grade';
import { Prompt } from './Prompt';

interface Props {
  ex: Extract<Exercise, { type: 'word_bank' }>;
  onChange: (v: string) => void;
  disabled: boolean;
}

const tile =
  'min-h-11 rounded-lg border border-stone-300 bg-white px-3 shadow-sm focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-30 dark:border-stone-700 dark:bg-stone-900';

export function WordBankInput({ ex, onChange, disabled }: Props) {
  const tokens = useMemo(() => wordBankTokens(ex), [ex]);
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onChange(next.map((i) => tokens[i]).join(' '));
  };

  // Tastatur: Backspace nimmt den letzten Baustein zurück.
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && picked.length) update(picked.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4">
      <Prompt instruction={t('ex.word_bank')} text={ex.prompt} ex={ex} lang="de" />
      <div
        aria-label={t('ex.word_bank.empty')}
        className="flex min-h-14 flex-wrap gap-2 border-b-2 border-stone-300 pb-2 dark:border-stone-700"
        lang="tr"
      >
        {picked.length === 0 && (
          <span className="self-center text-sm text-stone-400">{t('ex.word_bank.empty')}</span>
        )}
        {picked.map((i, pos) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-label={t('ex.word_bank.remove', { token: tokens[i]! })}
            onClick={() => update(picked.filter((_, p) => p !== pos))}
            className={tile}
          >
            {tokens[i]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" lang="tr">
        {tokens.map((token, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled || picked.includes(i)}
            onClick={() => update([...picked, i])}
            className={tile}
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}
