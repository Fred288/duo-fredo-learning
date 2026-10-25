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
