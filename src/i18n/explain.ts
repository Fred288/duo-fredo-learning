import type { Step } from '../morphology';
import { t } from './index';

/** Formuliert die strukturierten Engine-Schritte als deutsche Begründungen. */
export function explainSteps(steps: Step[]): string[] {
  return steps.map((step) => {
    const tag = t(`tag.${step.tag}`);
    switch (step.rule) {
      case 'harmony2':
        return t('explain.harmony2', {
          vowel: step.vowel,
          front: t(`explain.front.${step.front}`),
          chose: step.chose,
          tag,
        });
      case 'harmony4':
        return t('explain.harmony4', {
          vowel: step.vowel,
          front: t(`explain.front.${step.front}`),
          rounded: t(`explain.rounded.${step.rounded}`),
          chose: step.chose,
          tag,
        });
      case 'assimilation':
        return t(`explain.assimilation.${step.chose}`, {
          after: step.after,
          tag,
        });
      case 'buffer':
        return t('explain.buffer', { letter: step.letter, tag });
      case 'softening':
        return t('explain.softening', { from: step.from, to: step.to, tag });
      case 'pronominal_n':
        return t('explain.pronominal_n', { tag });
      case 'vowel_drop':
        return t('explain.vowel_drop', { vowel: step.vowel, tag });
      case 'stem_vowel_drop':
        return t('explain.stem_vowel_drop', { vowel: step.vowel, tag });
      case 'narrowing':
        return t('explain.narrowing', { chose: step.chose, tag });
      case 'stem_raising':
        return t('explain.stem_raising', { from: step.from, to: step.to, tag });
      case 'aorist_vowel':
        return t(`explain.aorist.${step.kind}`);
      case 'apostrophe':
        return t('explain.apostrophe', { tag });
    }
  });
}
