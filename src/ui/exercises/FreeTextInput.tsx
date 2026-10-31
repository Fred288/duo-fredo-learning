import { useRef } from 'react';
import type { Exercise } from '../../content/schema';
import { t } from '../../i18n';
import { SpecialCharBar } from '../SpecialCharBar';
import { Prompt } from './Prompt';

interface Props {
  ex: Extract<Exercise, { type: 'free_text' }>;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

export function FreeTextInput({ ex, value, onChange, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const toTurkish = ex.direction === 'de_tr';

  // Fügt an der Cursorposition ein und setzt den Cursor dahinter.
  const insert = (char: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + char + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + char.length, start + char.length);
    });
  };

  return (
    <div className="space-y-4">
      <Prompt
        instruction={t(`ex.free_text.${ex.direction}`)}
        text={ex.prompt}
        ex={ex}
        lang={toTurkish ? 'de' : 'tr'}
      />
      <input
        ref={input}
        type="text"
        autoFocus
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('ex.free_text.placeholder')}
        aria-label={t('ex.free_text.placeholder')}
        lang={toTurkish ? 'tr' : 'de'}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-lg focus-visible:outline-2 focus-visible:outline-focus"
      />
      {toTurkish && <SpecialCharBar onInsert={insert} disabled={disabled} />}
    </div>
  );
}
