import { t } from '../i18n';
import { SpeakButton } from './SpeakButton';
import type { ReactNode } from 'react';
import type { AnswerResult } from '../lib/answer';

const tone = {
  correct: 'border-success-line bg-success-soft text-success-ink',
  almost: 'border-warn-line bg-warn-soft text-warn-ink',
  wrong: 'border-danger-line bg-danger-soft text-danger-ink',
};

interface Props {
  result: AnswerResult;
  solution: string;
  explanation?: string;
  /** Regelbegründungen aus der Morphologie-Engine. */
  reasons?: string[];
  retry: boolean;
  /** Türkische Lösung zum Anhören (fehlt, wo die Lösung deutsch ist). */
  speak?: string;
  /**
   * Die Übung zeigt die Lösung nach der Antwort selbst (Hören: Satz und Bedeutung; Zerlegen,
   * Satzbau: `details`; Tabelle: die Zellen). Dann steht sie bei richtiger Antwort nicht doppelt da.
   */
  solutionShown?: boolean;
  /** Sprache der Lösung, wenn bekannt (Vorlesen und Aussprache für Screenreader). */
  solutionLang?: 'tr' | 'de';
  /** Aufbau der Lösung (Zerlegen: Stücke mit Rollen, Satzbau: Satzglieder mit Rollen). */
  details?: ReactNode;
}

export function Feedback({
  result,
  solution,
  explanation,
  reasons = [],
  retry,
  speak,
  details,
  solutionShown = false,
  solutionLang,
}: Props) {
  const shown = result.matched ?? solution;
  // Auch bei richtiger Antwort: Lösung zeigen und anhören, damit man hört, wie es klingen muss.
  const showSolution = result.verdict !== 'correct' || result.hints.length > 0 || !solutionShown;
  const speakButton = speak && (
    <span className="ml-1 align-middle">
      <SpeakButton text={speak} />
    </span>
  );
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 ${tone[result.verdict]}`}
    >
      <p className="font-semibold">
        {t(`feedback.${result.verdict}`)}
        {!showSolution && speakButton}
      </p>
      {showSolution && (
        <p className="mt-1">
          {t('feedback.solution.label')} <span lang={solutionLang}>{shown}</span>
          {speakButton}
        </p>
      )}
      {result.hints.map((h) => (
        <p key={h} className="mt-1 text-sm">
          {t(`feedback.hint.${h}`)}
        </p>
      ))}
      {details}
      {reasons.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-medium">{t('explain.title')}</p>
          <ul className="mt-1 list-disc pl-5">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {explanation && <p className="mt-2 text-sm">{explanation}</p>}
      {retry && <p className="mt-2 text-sm opacity-80">{t('feedback.retry')}</p>}
    </div>
  );
}
