import { create } from 'zustand';
import { db, safely } from '../db/db';
import type { Verdict } from '../lib/answer';
import { dayKey } from '../progress/day';
import type { Completion } from '../progress/stats';

interface ProgressState {
  completions: Completion[];
  loaded: boolean;
  load: () => Promise<void>;
  recordAttempt: (exerciseId: string, lessonId: string, verdict: Verdict) => void;
  recordCompletion: (unitId: string, lessonId: string, correct: number, total: number) => void;
}

export const useProgress = create<ProgressState>((set) => ({
  completions: [],
  loaded: false,
  load: async () => {
    const rows = await safely(() => db.completions.toArray(), []);
    // Lokal schon erfasste Abschlüsse (vor dem Laden) bleiben erhalten.
    set((s) => ({ completions: [...rows, ...s.completions], loaded: true }));
  },
  recordAttempt: (exerciseId, lessonId, verdict) => {
    void safely(() => db.attempts.add({ exerciseId, lessonId, verdict, at: Date.now() }), 0);
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
