import type { Exercise } from '../../content/schema';
import { speakables } from '../../audio/speakables';
import { t } from '../../i18n';
import { SpeakButton } from '../SpeakButton';

/** Aufgabenstellung mit Anweisung und Register-Kennzeichnung (sen/siz). */
export function Prompt({
  instruction,
  text,
  ex,
  lang,
}: {
  instruction: string;
  text: string;
  ex: Exercise;
  lang: 'de' | 'tr';
}) {
  // Türkischer Teil des Prompts (bei Multiple Choice und tr→de), sonst nichts.
  const spoken = speakables(ex).prompt;
  return (
    <div>
      <p className="text-sm text-ink-subtle">{instruction}</p>
      <p className="mt-2 text-2xl font-medium" lang={lang}>
        {text}
        {spoken && (
          <span className="ml-1 align-middle">
            <SpeakButton text={spoken} />
          </span>
        )}
      </p>
      {ex.register && (
        <span className="mt-2 inline-block rounded-full bg-fill px-2 py-0.5 text-xs">
          {t(`ex.register.${ex.register}`)}
        </span>
      )}
    </div>
  );
}
