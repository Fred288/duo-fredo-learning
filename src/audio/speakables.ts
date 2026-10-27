import type { Exercise } from '../content/schema';
import { speechText } from './speech-text';

/** Türkische Teile einer Übung zum Vorlesen: Prompt beim Anzeigen, Lösung im Feedback. */
export interface Speakables {
  prompt?: string;
  solution?: string;
}

const say = (text: string | undefined) => (text ? speechText(text) : undefined);

/** `matched` ist die akzeptierte Lösung, der die Eingabe zugeordnet wurde (Variante vor Kanon). */
export function speakables(ex: Exercise, matched?: string): Speakables {
  switch (ex.type) {
    case 'multiple_choice':
      return {
        prompt: say(ex.speak_prompt),
        solution: ex.speak_answer ? say(ex.answer) : undefined,
      };
    case 'word_bank':
      return { solution: say(matched ?? ex.answers[0]) };
    case 'free_text':
      return ex.direction === 'tr_de'
        ? { prompt: say(ex.prompt) }
        : { solution: say(matched ?? ex.answers[0]) };
    case 'suffix_builder':
    case 'conjugation':
      return { solution: say(ex.target) };
    case 'listen':
      return { prompt: say(ex.text), solution: say(ex.text) };
    case 'segment':
      return { solution: say(ex.word) };
    case 'sov_puzzle':
      return { solution: say(ex.order.join(' ')) };
    case 'paradigm':
      return {};
  }
}
