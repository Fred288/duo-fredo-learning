import type { Lesson, Level, Unit } from './schema';

// Inhalte sind im Build validiert (tools/build-content.ts), daher hier nur typisiert.
export interface Manifest {
  units: {
    id: string;
    level: Level;
    title: string;
    /** Pfad der Erklärkarte relativ zu content/, falls vorhanden. */
    explainer?: string;
    /** Anzahl noch nicht geprüfter Übungen und Vokabeln. */
    unreviewed: number;
    lessons: Pick<Lesson, 'id' | 'type' | 'title'>[];
    /** Vokabel-IDs der Unit (`vocabId`), Grundlage neuer SRS-Karten. */
    vocab: string[];
  }[];
}

const url = (path: string) => `${import.meta.env.BASE_URL}content/${path}`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchExplainer(path: string): Promise<string> {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

export const fetchManifest = () => getJson<Manifest>('index.json');
export const fetchUnit = (id: string) => getJson<Unit>(`units/${id}.json`);
