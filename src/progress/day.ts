/** Lokaler Kalendertag als 'YYYY-MM-DD' (nicht UTC: der Tag endet um lokale Mitternacht). */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Verschiebt einen Tagesschlüssel um n Tage (Sommerzeit-sicher über Mittag gerechnet). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return dayKey(new Date(y, m - 1, d + n, 12));
}

/** Tage von `from` bis `to` (beide 'YYYY-MM-DD'); negativ, wenn `to` davor liegt. */
export function daysBetween(from: string, to: string): number {
  const utc = (day: string) => {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Montag der Woche, in der `day` liegt (Woche Montag bis Sonntag). */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const weekday = new Date(y, m - 1, d, 12).getDay(); // 0 = Sonntag
  return addDays(day, -((weekday + 6) % 7));
}

/** Erster Tag des Monats, in dem `day` liegt. */
export const monthStart = (day: string): string => `${day.slice(0, 8)}01`;

/** Anzahl Tage des Monats, in dem `day` liegt. */
export function daysInMonth(day: string): number {
  const [y, m] = day.split('-').map(Number) as [number, number];
  return new Date(y, m, 0, 12).getDate();
}
