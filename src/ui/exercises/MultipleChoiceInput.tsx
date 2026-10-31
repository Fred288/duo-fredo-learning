import { useEffect } from 'react';
import type { Exercise } from '../../content/schema';
import { t } from '../../i18n';
import { Prompt } from './Prompt';

interface Props {
  ex: Extract<Exercise, { type: 'multiple_choice' }>;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

export function MultipleChoiceInput({ ex, value, onChange, disabled }: Props) {
  // Tastatur: 1–9 wählt die Option.
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const option = ex.options[Number(e.key) - 1];
      if (option) onChange(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ex.options, onChange, disabled]);

  return (
    <fieldset className="space-y-4">
      <legend className="w-full">
        <Prompt instruction={t('ex.multiple_choice')} text={ex.prompt} ex={ex} lang="de" />
      </legend>
      <div className="grid gap-2">
        {ex.options.map((option, i) => {
          const selected = option === value;
          return (
            <label
              key={option}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 has-focus-visible:outline-2 has-focus-visible:outline-focus ${
                selected
                  ? 'border-brand-edge bg-brand-soft'
                  : 'border-line bg-surface'
              }`}
            >
              <input
                type="radio"
                name={ex.id}
                value={option}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <kbd className="text-xs text-ink-subtle">{i + 1}</kbd>
              <span lang="tr">{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
