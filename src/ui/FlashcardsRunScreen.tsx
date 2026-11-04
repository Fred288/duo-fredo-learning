import { useEffect, useRef, useState } from 'react';
import { speechText } from '../audio/speech-text';
import { fetchLookup, fetchUnit } from '../content/load';
import { deckFor, type Selection } from '../flashcards/deck';
import {
  facesOf,
  flagHints,
  type CardData,
  type Faces,
  type PhraseExercise,
} from '../flashcards/faces';
import {
  againCount,
  current,
  grade,
  isDone,
  startRound,
  summary,
  type Round,
} from '../flashcards/round';
import { cardKey, type DeckCard, type FlashMode } from '../flashcards/types';
import { t } from '../i18n';
import { checkAnswer, type Verdict } from '../lib/answer';
import { completedLessonIds } from '../progress/stats';
import { useApp } from '../store/app';
import { useFlashcards, useIsMarked } from '../store/flashcards';
import { useProgress } from '../store/progress';
import { useAudio, useAutoplay, useCanSpeak } from '../store/audio';
import { useSettings } from '../store/settings';
import { formLabelText } from './LookupEntry';
import { ShadowButton } from './ShadowButton';
import { SpeakButton } from './SpeakButton';
import { SpecialCharBar } from './SpecialCharBar';
import { useManifest } from './useManifest';

const primary =
  'min-h-12 flex-1 rounded-xl bg-brand px-5 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const secondary =
  'min-h-12 flex-1 rounded-xl border border-line-strong bg-surface px-5 font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';

/** Tasten, die nicht dem Karteikasten gehören: Tippen in Feldern, Leertaste/Enter auf Knöpfen. */
const ownsKeys = (el: EventTarget | null, key: string) =>
  el instanceof HTMLElement &&
  (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ||
    ((key === ' ' || key === 'Enter') && /^(BUTTON|A|SUMMARY)$/.test(el.tagName)));

async function loadData(cards: readonly DeckCard[]): Promise<CardData> {
  const unitIds = [...new Set(cards.filter((c) => c.kind === 'phrase').map((c) => c.unitId))];
  const [index, ...units] = await Promise.all([
    fetchLookup(),
    ...unitIds.map((id) => fetchUnit(id)),
  ]);
  const phrases = new Map<string, PhraseExercise>();
  for (const u of units)
    for (const l of u.lessons)
      for (const e of l.exercises)
        if (e.type === 'word_bank' || e.type === 'free_text') phrases.set(e.id, e);
  return { vocab: new Map(index.vocab.map((v) => [v.id, v])), phrases };
}

function MarkButton({ card }: { card: DeckCard }) {
  const marked = useIsMarked(card);
  const setMarked = useFlashcards((s) => s.setMarked);
  return (
    <button
      type="button"
      aria-pressed={marked}
      onClick={() => setMarked(card, !marked)}
      className={`min-h-11 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-focus ${
        marked
          ? 'border-brand-edge bg-brand-soft text-brand-ink'
          : 'border-line-strong hover:bg-hover'
      }`}
    >
      <span aria-hidden="true">{marked ? '★ ' : '☆ '}</span>
      {t('flash.mark')}
    </button>
  );
}

/** Rückseite: Lösung, Vorlesen/Nachsprechen, Wortart und Formhinweise bzw. Hinweis der Übung. */
function Back({ faces, card }: { faces: Faces; card: DeckCard }) {
  const backLang = faces.frontLang === 'tr' ? 'de' : 'tr';
  const say = speechText(faces.turkish);
  const hints = faces.vocab ? flagHints(faces.vocab) : [];
  const note = faces.phrase?.hint ?? faces.phrase?.explanation;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      {faces.listen && (
        <p className="text-xl font-medium" lang="tr">
          {faces.turkish}
        </p>
      )}
      <p className={faces.listen ? 'text-lg' : 'text-xl font-medium'} lang={backLang}>
        {faces.back}
      </p>
      {faces.vocab && (
        <p className="text-sm text-ink-muted">
          {t(`pos.${faces.vocab.pos}`)}
          {faces.vocab.register &&
            ` · ${t(faces.vocab.register === 'formal' ? 'lookup.formal' : 'lookup.informal')}`}
        </p>
      )}
      {hints.length > 0 && (
        <div className="text-sm">
          <p className="text-ink-muted">{t('flash.forms')}</p>
          <ul>
            {hints.map((h) => (
              <li key={h.form}>
                <span lang="tr" className="font-medium">
                  {h.form}
                </span>{' '}
                <span className="text-ink-muted">({formLabelText(h.label)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className="text-sm text-ink-muted">{note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {say && <SpeakButton text={say} />}
        {say && <ShadowButton text={say} />}
        <MarkButton card={card} />
      </div>
    </div>
  );
}

/** Eine Karte: Vorderseite, dann Aufdecken und selbst bewerten oder Eintippen und prüfen. */
function CardView({
  card,
  faces,
  mode,
  onGrade,
}: {
  card: DeckCard;
  faces: Faces;
  mode: FlashMode;
  onGrade: (correct: boolean) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<Verdict>();
  const tolerateDiacritics = useSettings((s) => s.tolerateDiacritics);
  const front = useRef<HTMLHeadingElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const shown = mode === 'flip' ? flipped : verdict !== undefined;
  const toTurkish = faces.frontLang === 'de';
  const say = faces.listen
    ? speechText(faces.turkish)
    : faces.frontLang === 'tr'
      ? speechText(faces.front)
      : undefined;
  useAutoplay(say, !!faces.listen);

  // Neue Karte: Fokus auf die Vorderseite (Ansage) bzw. ins Feld.
  useEffect(() => {
    (mode === 'type' ? input.current : front.current)?.focus();
  }, [mode]);
  // Aufgedeckt: Fokus auf die Rückseite, damit sie angesagt wird und die Tasten weiter gelten.
  useEffect(() => {
    if (!shown) return;
    if (mode === 'type') next.current?.focus();
    else back.current?.focus();
  }, [shown, mode]);

  const doFlip = () => setFlipped(true);
  const check = () => {
    if (!value.trim()) return;
    setVerdict(checkAnswer(value, faces.answers, { tolerateDiacritics }).verdict);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || ownsKeys(e.target, e.key)) return;
      if (mode === 'flip' && !flipped && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        doFlip();
      } else if (mode === 'flip' && flipped && (e.key === 'ArrowRight' || e.key === '2')) {
        e.preventDefault();
        onGrade(true);
      } else if (mode === 'flip' && flipped && (e.key === 'ArrowLeft' || e.key === '1')) {
        e.preventDefault();
        onGrade(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, flipped, onGrade]);

  const insert = (char: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + char + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + char.length, start + char.length);
    });
  };

  return (
    <div className="card space-y-4 rounded-2xl border border-line p-5" data-card={cardKey(card)}>
      <p className="text-sm text-ink-subtle">
        {t(`flash.dir.${card.dir}`)}
        {card.kind === 'phrase' && ` · ${t('flash.content.phrase')}`}
      </p>
      <div className="flex items-start gap-1">
        <h2
          ref={front}
          tabIndex={-1}
          lang={faces.listen ? 'de' : faces.frontLang}
          className="flex-1 text-2xl font-semibold outline-none"
        >
          {faces.listen ? t('flash.listen.prompt') : faces.front}
        </h2>
        {say && <SpeakButton text={say} />}
      </div>

      {mode === 'flip' && !flipped && (
        <button type="button" onClick={doFlip} className={`${secondary} w-full`}>
          {t('flash.flip')}
        </button>
      )}

      {mode === 'type' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (verdict === undefined) check();
          }}
        >
          <input
            ref={input}
            type="text"
            value={value}
            readOnly={verdict !== undefined}
            onChange={(e) => setValue(e.target.value)}
            aria-label={t('flash.answer')}
            placeholder={t('flash.answer')}
            lang={toTurkish ? 'tr' : 'de'}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-12 w-full rounded-xl border border-field-edge bg-surface px-4 text-lg focus-visible:outline-2 focus-visible:outline-focus"
          />
          {toTurkish && verdict === undefined && (
            <SpecialCharBar onInsert={insert} disabled={false} />
          )}
          {verdict === undefined && (
            <button
              type="submit"
              disabled={!value.trim()}
              className={`${primary} w-full disabled:opacity-40`}
            >
              {t('flash.check')}
            </button>
          )}
        </form>
      )}

      <div ref={back} tabIndex={-1} aria-live="polite" className="outline-none">
        {shown && (
          <>
            {verdict && (
              <p
                className={`mb-3 font-medium ${
                  verdict === 'wrong' ? 'text-danger-ink' : 'text-success-ink'
                }`}
              >
                {t(`flash.result.${verdict}`)}
              </p>
            )}
            <Back faces={faces} card={card} />
          </>
        )}
      </div>

      {mode === 'flip' && flipped && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onGrade(false)}
            aria-keyshortcuts="ArrowLeft 1"
            className={secondary}
          >
            {t('flash.unknown')}
          </button>
          <button
            type="button"
            onClick={() => onGrade(true)}
            aria-keyshortcuts="ArrowRight 2"
            className={primary}
          >
            {t('flash.known')}
          </button>
        </div>
      )}
      {mode === 'type' && verdict !== undefined && (
        <button
          ref={next}
          type="button"
          onClick={() => onGrade(verdict !== 'wrong')}
          className={`${primary} w-full`}
        >
          {t('flash.next')}
        </button>
      )}
    </div>
  );
}

/** Eine Runde im Karteikasten (Fokusbereich). Antworten gehen in den Karteikasten, nicht ins SRS. */
export function FlashcardsRunScreen({
  selection,
  mode,
}: {
  selection: Selection;
  mode: FlashMode;
}) {
  const goBack = useApp((s) => s.goBack);
  const recordFlash = useFlashcards((s) => s.recordFlash);
  const flashesLoaded = useFlashcards((s) => s.loaded);
  const progressLoaded = useProgress((s) => s.loaded);
  const canListen = useCanSpeak();
  // Hörkarten brauchen die Stimme: erst starten, wenn sie geladen sind (oder fehlen).
  const voicesLoading = useAudio((s) => s.status === 'loading') && selection.dir === 'listen';
  const { manifest, failed } = useManifest();
  const [data, setData] = useState<CardData>();
  const [round, setRound] = useState<Round>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [turn, setTurn] = useState(0);
  const started = useRef(false);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  // Stapel einmal beim Öffnen (Momentaufnahme); neue Antworten ändern die laufende Runde nicht.
  useEffect(() => {
    if (!manifest || !flashesLoaded || !progressLoaded || voicesLoading || started.current) return;
    started.current = true;
    const { flashes, marks } = useFlashcards.getState();
    const { completions, cards: srsCards } = useProgress.getState();
    const completedLessons = completedLessonIds(completions);
    const cards = deckFor(manifest.units, selection, {
      flashes,
      marks,
      completedLessons,
      srsCards,
      canListen,
    });
    loadData(cards)
      .then((d) => {
        setData(d);
        // Inzwischen entfernte Wörter oder Sätze fallen still heraus.
        setRound(startRound(cards.filter((c) => facesOf(c, d))));
      })
      .catch(() => setLoadFailed(true));
  }, [manifest, flashesLoaded, progressLoaded, voicesLoading, canListen, selection]);

  const finished = round !== undefined && isDone(round);
  useEffect(() => {
    if (finished) doneHeading.current?.focus();
  }, [finished]);

  const header = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={goBack}
        className="min-h-11 rounded-lg px-3 text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
      >
        {t('flash.cancel')}
      </button>
      {round && !finished && <Progress round={round} />}
    </div>
  );

  let body;
  if (failed || loadFailed) body = <p className="text-danger">{t('home.error')}</p>;
  else if (!round || !data) body = <p className="text-ink-subtle">{t('flash.loading')}</p>;
  else if (round.cards.length === 0) {
    body = (
      <div className="space-y-4 text-center">
        <p>{t('flash.empty')}</p>
        <button type="button" autoFocus onClick={goBack} className={`${primary} w-full`}>
          {t('flash.done.back')}
        </button>
      </div>
    );
  } else if (finished) {
    const s = summary(round);
    body = (
      <div className="card space-y-4 rounded-2xl border border-line p-5 text-center">
        <h2 ref={doneHeading} tabIndex={-1} className="text-xl font-semibold outline-none">
          {t('flash.done.title')}
        </h2>
        <p>{t('flash.done.summary', { first: s.firstTry, retried: s.retried })}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {s.wrong.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRound(startRound(s.wrong));
                setTurn((n) => n + 1);
              }}
              className={primary}
            >
              {t('flash.done.again', { count: s.wrong.length })}
            </button>
          )}
          <button type="button" onClick={goBack} className={secondary}>
            {t('flash.done.back')}
          </button>
        </div>
      </div>
    );
  } else {
    const card = current(round)!;
    const faces = facesOf(card, data)!;
    // `key`: Jede Karte (auch eine wiederkehrende) beginnt frisch, mit Fokus auf der Vorderseite.
    body = (
      <CardView
        key={`${cardKey(card)}#${turn}`}
        card={card}
        faces={faces}
        mode={mode}
        onGrade={(correct) => {
          const g = grade(round, correct);
          if (g.record) recordFlash(g.record.card, g.record.correct, mode);
          setRound(g.round);
          setTurn((n) => n + 1);
        }}
      />
    );
  }

  return (
    <section aria-labelledby="flash-run-title">
      <h1 id="flash-run-title" className="sr-only">
        {t('flash.title')}
      </h1>
      {header}
      {body}
    </section>
  );
}

function Progress({ round }: { round: Round }) {
  const card = current(round);
  const again = againCount(round);
  const repeat = card && round.first.has(cardKey(card));
  return (
    <p className="text-sm text-ink-muted" aria-live="polite">
      {repeat
        ? t('flash.progress.again')
        : t('flash.progress', {
            n: Math.min(round.first.size + 1, round.cards.length),
            total: round.cards.length,
          })}
      {again > 0 && ` · ${t('flash.again', { count: again })}`}
    </p>
  );
}
