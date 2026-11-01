import { t } from '../i18n';
import { dayKey } from '../progress/day';
import { activeDays, carriedStreak } from '../progress/stats';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

/** Aktuelle Serie zum Anzeigen; 0 = nichts anzeigen (keine Serie oder abgeschaltet). */
export function useStreakDays(): number {
  const completions = useProgress((s) => s.completions);
  const showStreak = useSettings((s) => s.showStreak);
  const streakCarry = useSettings((s) => s.streakCarry);
  const streakCarryDay = useSettings((s) => s.streakCarryDay);
  if (!showStreak) return 0;
  return carriedStreak(activeDays(completions), dayKey(), streakCarry, streakCarryDay);
}

/** Serie am oberen Rand: rechts auf dem Handy, ab 768 px oben in der Seitenleiste. */
export function StreakBadge({ days }: { days: number }) {
  return (
    <div className="pointer-events-none fixed top-[calc(0.5rem+var(--safe-top))] right-[max(1rem,var(--safe-right))] z-20 md:right-auto md:left-[var(--safe-left)] md:flex md:w-[var(--side-w)] md:justify-center">
      <span className="flex items-center gap-1 rounded-full border border-line glass-strong px-3 py-1 text-sm font-medium">
        <span aria-hidden="true">🔥 {days}</span>
        <span className="sr-only">
          {days === 1 ? t('goal.streak.one') : t('goal.streak.many', { count: days })}
        </span>
      </span>
    </div>
  );
}
