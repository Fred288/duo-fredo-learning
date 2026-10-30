import type { Vocab } from '../content/schema';
import type { Supported } from '../session/grade';
import { ConjugationInput } from './exercises/ConjugationInput';
import { FreeTextInput } from './exercises/FreeTextInput';
import { ListenInput } from './exercises/ListenInput';
import { MultipleChoiceInput } from './exercises/MultipleChoiceInput';
import { ParadigmInput } from './exercises/ParadigmInput';
import { SegmentInput } from './exercises/SegmentInput';
import { SentenceOrderInput } from './exercises/SentenceOrderInput';
import { SuffixBuilderInput } from './exercises/SuffixBuilderInput';
import { WordBankInput } from './exercises/WordBankInput';

interface Props {
  ex: Supported;
  /** Wortschatz der Unit (plus `lexicon`); liefert Flags für die Bausteine. */
  vocab?: readonly Vocab[];
  /** Aktuelle Antwort (nur Eingaben mit Textwert lesen sie). */
  value: string;
  onChange: (answer: string) => void;
  disabled: boolean;
}

/**
 * Prompt und Eingabe einer Übung, ohne Prüfen, Rückmeldung und Wiederholung. Gemeinsam für
 * Lektionen (`LessonRunner`) und Einstufung (`PlacementScreen`). Der Aufrufer setzt `key` je
 * Übung, damit der Eingabezustand beim Wechsel verfällt.
 */
export function ExerciseView({ ex, vocab = [], value, onChange, disabled }: Props) {
  switch (ex.type) {
    case 'multiple_choice':
      return <MultipleChoiceInput ex={ex} value={value} onChange={onChange} disabled={disabled} />;
    case 'word_bank':
      return <WordBankInput ex={ex} onChange={onChange} disabled={disabled} />;
    case 'free_text':
      return <FreeTextInput ex={ex} value={value} onChange={onChange} disabled={disabled} />;
    case 'conjugation':
      return <ConjugationInput ex={ex} vocab={vocab} onChange={onChange} disabled={disabled} />;
    case 'listen':
      return <ListenInput ex={ex} value={value} onChange={onChange} disabled={disabled} />;
    case 'paradigm':
      return <ParadigmInput ex={ex} onChange={onChange} disabled={disabled} />;
    case 'segment':
      return <SegmentInput ex={ex} onChange={onChange} disabled={disabled} />;
    case 'sov_puzzle':
      return <SentenceOrderInput ex={ex} onChange={onChange} disabled={disabled} />;
    case 'suffix_builder':
      return <SuffixBuilderInput ex={ex} vocab={vocab} onChange={onChange} disabled={disabled} />;
  }
}
