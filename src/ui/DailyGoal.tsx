import { t } from '../i18n';
import { dayKey } from '../progress/day';
import { lessonsOnDay } from '../progress/stats';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

/** Dezente Tagesübersicht: Ziel-Balken. */
export function DailyGoal() {
  const completions = useProgress((s) => s.completions);
  const goal = useSettings((s) => s.dailyGoal);

  const today = dayKey();
  const done = lessonsOnDay(completions, today);
  const label = t('goal.today', { done: Math.min(done, goal), goal });

  return (
    <section aria-label={t('goal.today', { done, goal })} className="mt-6 space-y-2">
      <div className="text-sm">{done >= goal ? t('goal.reached') : label}</div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(done, goal)}
        className="h-2 overflow-hidden rounded-full bg-fill"
      >
        <div
          className="h-full bg-brand-bar transition-[width]"
          style={{ width: `${(Math.min(done, goal) / goal) * 100}%` }}
        />
      </div>
    </section>
  );
}
