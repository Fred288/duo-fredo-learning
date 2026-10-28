import type { Exercise } from '../content/schema';
import { t } from '../i18n';
import { segmentPieces, segmentVariants } from '../session/segment';
import { matchedVariant, orderOf, validOrders } from '../session/word-order';

/**
 * Lösung einer Zerlege-Übung: Stück für Stück mit Rolle, je richtig oder falsch markiert, in der
 * Zerlegung, die der Antwort am nächsten liegt. Gibt es zwei übliche (Präsens), steht das dabei.
 */
export function SegmentFeedback({
  ex,
  answer,
}: {
  ex: Extract<Exercise, { type: 'segment' }>;
  answer: string;
}) {
  const pieces = segmentPieces(ex, answer);
  const variants = segmentVariants(ex).map((v) => v.map((s) => s.text).join('-'));
  return (
    <div className="mt-2 text-sm">
      <p className="font-medium">{t('ex.segment.solution')}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {pieces.map((p, i) => (
          <li
            key={i}
            className="rounded-md border border-current/30 px-2 py-1"
            data-correct={p.correct}
          >
            <span className="font-medium" lang="tr">
              {p.text}
            </span>{' '}
            <span>{t(`tag.${p.tag}`)}</span>{' '}
            <span aria-label={t(p.correct ? 'ex.paradigm.ok' : 'feedback.wrong')}>
              {p.correct ? '✓' : '✗'}
            </span>
          </li>
        ))}
      </ul>
      {variants.length > 1 && (
        <p className="mt-2">{t('ex.segment.both', { a: variants[0]!, b: variants[1]! })}</p>
      )}
    </div>
  );
}

/** Satzglieder in der angenommenen (sonst der Grund-)Reihenfolge mit Rolle, dazu der Fokus-Hinweis. */
export function OrderFeedback({
  ex,
  answer,
}: {
  ex: Extract<Exercise, { type: 'sov_puzzle' }>;
  answer: string;
}) {
  const given = orderOf(ex, answer);
  const accepted = given && validOrders(ex).some((v) => v.join() === given.join());
  const order = accepted ? given : validOrders(ex)[0]!;
  const note = matchedVariant(ex, answer)?.note;
  return (
    <div className="mt-2 text-sm">
      <p className="font-medium">{t('ex.sov_puzzle.solution')}</p>
      <ol className="mt-1 flex flex-wrap gap-2">
        {order.map((i) => {
          const chunk = ex.chunks[i]!;
          return (
            <li key={i} className="rounded-md border border-current/30 px-2 py-1">
              <span className="font-medium" lang="tr">
                {chunk.text}
              </span>{' '}
              <span>{t(`sov.role.${chunk.role}`)}</span>
            </li>
          );
        })}
      </ol>
      {note && <p className="mt-2">{note}</p>}
    </div>
  );
}
