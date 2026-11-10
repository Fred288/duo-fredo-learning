import { t, type MessageKey } from '../i18n';
import { dayKey } from '../progress/day';
import { lessonsOnDay, periodGoals } from '../progress/stats';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

/**
 * Dezente Zielübersicht: Tagesziel, darunter (abschaltbar) Wochen- und Monatsziel, beide aus dem
 * Tagesziel abgeleitet. Nur Balken, keine Punkte oder Rekorde (SPEC 2).
 */
export function DailyGoal() {
  const completions = useProgress((s) => s.completions);
  const goal = useSettings((s) => s.dailyGoal);
  const showPeriods = useSettings((s) => s.showPeriodGoals);

  const today = dayKey();
  const done = lessonsOnDay(completions, today);
  const periods = showPeriods ? periodGoals(completions, today, goal) : undefined;

  return (
    <section aria-label={t('goal.title')} className="mt-6 space-y-3">
      <GoalBar done={done} goal={goal} label="goal.today" reached="goal.reached" />
      {periods && (
        <>
          <GoalBar
            small
            done={periods.week.done}
            goal={periods.week.goal}
            label="goal.week"
            reached="goal.week.reached"
          />
          <GoalBar
            small
            done={periods.month.done}
            goal={periods.month.goal}
            label="goal.month"
            reached="goal.month.reached"
          />
        </>
      )}
    </section>
  );
}

function GoalBar({
  done,
  goal,
  label,
  reached,
  small = false,
}: {
  done: number;
  goal: number;
  label: MessageKey;
  reached: MessageKey;
  small?: boolean;
}) {
  const shown = Math.min(done, goal);
  const text = t(label, { done: shown, goal });
  return (
    <div className="space-y-1.5">
      <div className={small ? 'text-xs text-ink-muted' : 'text-sm'}>
        {done >= goal ? t(reached) : text}
      </div>
      <div
        role="progressbar"
        aria-label={text}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={shown}
        className={`${small ? 'h-1.5' : 'h-2'} overflow-hidden rounded-full bg-fill`}
      >
        <div
          className="h-full bg-brand-bar transition-[width]"
          style={{ width: `${(shown / goal) * 100}%` }}
        />
      </div>
    </div>
  );
}
