import { create } from 'zustand';
import { db, safely } from '../db/db';
import type { Verdict } from '../lib/answer';
import { dayKey } from '../progress/day';
import type { Attempt, Completion } from '../progress/stats';

interface ProgressState {
  completions: Completion[];
  /** Erste Versuche je Lauf, Grundlage für "Fehler wiederholen". */
  attempts: Attempt[];
  loaded: boolean;
  load: () => Promise<void>;
  recordAttempt: (exerciseId: string, lessonId: string, verdict: Verdict) => void;
  recordCompletion: (unitId: string, lessonId: string, correct: number, total: number) => void;
}

export const useProgress = create<ProgressState>((set) => ({
  completions: [],
  attempts: [],
  loaded: false,
  load: async () => {
    const [rows, attempts] = await Promise.all([
      safely(() => db.completions.toArray(), []),
      safely(() => db.attempts.toArray(), []),
    ]);
    // Lokal schon erfasste Einträge (vor dem Laden) bleiben erhalten.
    set((s) => ({
      completions: [...rows, ...s.completions],
      attempts: [...attempts, ...s.attempts],
      loaded: true,
    }));
  },
  recordAttempt: (exerciseId, lessonId, verdict) => {
    const attempt: Attempt = { exerciseId, lessonId, verdict, at: Date.now() };
    set((s) => ({ attempts: [...s.attempts, attempt] }));
    void safely(() => db.attempts.add({ ...attempt }), 0);
  },
  recordCompletion: (unitId, lessonId, correct, total) => {
    const now = new Date();
    const completion: Completion = {
      lessonId,
      unitId,
      correct,
      total,
      at: now.getTime(),
      day: dayKey(now),
    };
    set((s) => ({ completions: [...s.completions, completion] }));
    void safely(() => db.completions.add({ ...completion }), 0);
  },
}));
