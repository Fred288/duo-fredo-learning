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
        return t(step.chose === 't' ? 'explain.assimilation.t' : 'explain.assimilation.d', {
          after: step.after,
          tag,
        });
      case 'buffer':
        return t('explain.buffer', { letter: step.letter, tag });
      case 'softening':
        return t('explain.softening', { from: step.from, to: step.to, tag });
      case 'pronominal_n':
        return t('explain.pronominal_n', { tag });
    }
  });
}
