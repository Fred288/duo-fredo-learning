import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchUnit } from '../content/load';
import type { PracticeText } from '../content/schema';
import { t } from '../i18n';
import { pickText, rememberText, type TextRef } from '../practice/pick';
import { useApp } from '../store/app';
import { useSettings, type PracticeMode } from '../store/settings';
import { ReadingPassage } from './ReadingPassage';
import { SpeakButton } from './SpeakButton';
import { TokenText } from './TokenText';
import { useManifest } from './useManifest';

const buttonBase =
  'min-h-12 w-full rounded-xl px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const MODES: readonly PracticeMode[] = ['read', 'translate'];

/**
 * Übungstext nach der Lektion: lesen (wie ein Lesetext) oder Satz für Satz übersetzen und selbst
 * mit der Referenz vergleichen. Nichts wird gespeichert außer der Liste zuletzt gelesener Texte.
 */
export function PracticeScreen({ unitId, text: ref }: { unitId: string; text: TextRef }) {
  const goBack = useApp((s) => s.goBack);
  const openTextPractice = useApp((s) => s.openTextPractice);
  const mode = useSettings((s) => s.practiceMode);
  const recent = useSettings((s) => s.practiceRecent);
  const setSetting = useSettings((s) => s.set);
  const { manifest } = useManifest();
  const [text, setText] = useState<PracticeText>();
  const [level, setLevel] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchUnit(ref.unitId)
      .then((unit) => {
        const found = unit.texts?.find((x) => x.id === ref.id);
        if (!found) return setFailed(true);
        setText(found);
        setLevel(unit.level);
      })
      .catch(() => setFailed(true));
    // Nur gegen Wiederholung im Angebot; keine Wertung.
    const { practiceRecent, set } = useSettings.getState();
    set('practiceRecent', rememberText(practiceRecent, ref.id));
  }, [ref.unitId, ref.id]);

  const other = manifest && pickText(manifest.units, unitId, rememberText(recent, ref.id));
  const actions = (
    <div className="space-y-2">
      {other && other.id !== ref.id && (
        <button
          type="button"
          className={`${buttonBase} bg-fill`}
          onClick={() => openTextPractice(unitId, other, { replace: true })}
        >
          {t('practice.other')}
        </button>
      )}
      <button type="button" className={`${buttonBase} bg-brand text-on-brand`} onClick={goBack}>
        {t('practice.finish')}
      </button>
    </div>
  );

  return (
    <section className="space-y-6" aria-labelledby="practice-title">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="min-h-11 rounded-lg px-3 text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          ← {t('runner.back')}
        </button>
        <div>
          <h1 id="practice-title" tabIndex={-1} className="text-xl font-semibold">
            {ref.title}
          </h1>
          <p className="text-sm text-ink-subtle">
            {t('practice.kind')}
            {level && ` · ${level}`}
          </p>
        </div>
      </header>
      <fieldset>
        <legend className="sr-only">{t('practice.mode')}</legend>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <label
              key={m}
              className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 has-focus-visible:outline-2 has-focus-visible:outline-focus ${
                mode === m ? 'border-brand-edge bg-brand-soft' : 'border-line-strong bg-surface'
              }`}
            >
              <input
                type="radio"
                name="practice-mode"
                value={m}
                checked={mode === m}
                onChange={() => setSetting('practiceMode', m)}
                className="sr-only"
              />
              {t(`practice.mode.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {failed && <p className="text-danger">{t('home.error')}</p>}
      {!text && !failed && <p className="text-ink-subtle">{t('practice.loading')}</p>}
      {text && mode === 'read' && (
        <>
          <p className="text-sm text-ink-subtle">{t('reading.hint')}</p>
          <ReadingPassage passage={text} />
          {actions}
        </>
      )}
      {text && mode === 'translate' && <TranslateText text={text} actions={actions} />}
    </section>
  );
}

/** Satz für Satz: übersetzen (freiwillig), vergleichen, selbst „Passt“ oder „Daneben“ wählen. */
function TranslateText({ text, actions }: { text: PracticeText; actions: ReactNode }) {
  const [order, setOrder] = useState(() => text.sentences.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [off, setOff] = useState<number[]>([]);
  const head = useRef<HTMLHeadingElement>(null);
  const fits = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  // Nach dem Vergleichen steht der Fokus auf „Passt“ (Enter = weiter); bei jedem neuen Satz und
  // am Ende auf der Überschrift (Ansage für Screenreader). Nicht beim ersten Anzeigen.
  useEffect(() => {
    if (revealed) fits.current?.focus();
  }, [revealed]);
  useEffect(() => {
    if (moved.current) head.current?.focus();
  }, [pos, order]);

  const grade = (ok: boolean) => {
    if (!ok) setOff((o) => [...o, order[pos]!]);
    moved.current = true;
    setPos((p) => p + 1);
    setDraft('');
    setRevealed(false);
  };

  if (pos >= order.length) {
    return (
      <div className="space-y-4" aria-labelledby="practice-done">
        <h2 id="practice-done" ref={head} tabIndex={-1} className="text-lg font-semibold">
          {t('practice.done')}
        </h2>
        {off.length === 0 ? (
          <p>{t('practice.done.all')}</p>
        ) : (
          <>
            <p>{t('practice.done.off')}</p>
            <ul className="space-y-3">
              {off.map((i) => (
                <li key={i} className="card rounded-xl p-3">
                  <p lang="tr" className="text-lg">
                    {text.sentences[i]!.tr}
                  </p>
                  <p lang="de" className="text-sm text-ink-muted">
                    {text.sentences[i]!.de}
                  </p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`${buttonBase} bg-fill`}
              onClick={() => {
                moved.current = true;
                setOrder(off);
                setOff([]);
                setPos(0);
              }}
            >
              {t('practice.again')}
            </button>
          </>
        )}
        <details className="rounded-xl border border-line bg-surface p-3">
          <summary className="min-h-11 cursor-pointer content-center font-medium">
            {t('practice.whole')}
          </summary>
          <div className="mt-3">
            <ReadingPassage passage={text} />
          </div>
        </details>
        {actions}
      </div>
    );
  }

  const index = order[pos]!;
  const sentence = text.sentences[index]!;
  const tokens = text.tokens?.[index] ?? [{ text: sentence.tr }];
  const compare = () => setRevealed(true);

  return (
    <div className="space-y-4">
      <h2 ref={head} tabIndex={-1} className="text-sm font-medium text-ink-muted">
        {t('practice.sentence', { n: pos + 1, total: order.length })}
      </h2>
      <div className="flex items-start gap-1">
        <p lang="tr" className="flex-1 text-xl leading-relaxed">
          <TokenText tokens={tokens} />
        </p>
        <SpeakButton text={sentence.tr} />
      </div>
      <label className="block space-y-1">
        <span className="block text-sm text-ink-muted">{t('practice.yours')}</span>
        <textarea
          value={draft}
          readOnly={revealed}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter vergleicht, Umschalt+Enter macht eine neue Zeile.
            if (e.key === 'Enter' && !e.shiftKey && !revealed) {
              e.preventDefault();
              compare();
            }
          }}
          rows={2}
          lang="de"
          className="w-full rounded-lg border border-field-edge bg-surface p-2"
        />
      </label>
      {!revealed ? (
        <button type="button" className={`${buttonBase} bg-brand text-on-brand`} onClick={compare}>
          {t('practice.compare')}
        </button>
      ) : (
        <>
          <div role="status" className="card space-y-1 rounded-xl p-3">
            <p className="text-sm text-ink-muted">{t('practice.reference')}</p>
            <p lang="de" className="text-lg">
              {sentence.de}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${buttonBase} bg-fill`}
              onClick={() => grade(false)}
            >
              {t('practice.off')}
            </button>
            <button
              ref={fits}
              type="button"
              className={`${buttonBase} bg-brand text-on-brand`}
              onClick={() => grade(true)}
            >
              {t('practice.fits')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
