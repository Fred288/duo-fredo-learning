import { t } from '../i18n';
import { dayKey } from '../progress/day';
import { activeDays, lessonsOnDay, streak } from '../progress/stats';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

/** Dezente Tagesübersicht: Ziel-Balken und (abschaltbar) die Serie. */
export function DailyGoal() {
  const completions = useProgress((s) => s.completions);
  const goal = useSettings((s) => s.dailyGoal);
  const showStreak = useSettings((s) => s.showStreak);

  const today = dayKey();
  const done = lessonsOnDay(completions, today);
  const days = streak(activeDays(completions), today);
  const label = t('goal.today', { done: Math.min(done, goal), goal });

  return (
    <section aria-label={t('goal.today', { done, goal })} className="mt-6 space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{done >= goal ? t('goal.reached') : label}</span>
        {showStreak && days > 0 && (
          <span className="text-ink-subtle">
            {days === 1 ? t('goal.streak.one') : t('goal.streak.many', { count: days })}
          </span>
        )}
      </div>
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
