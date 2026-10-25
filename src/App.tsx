import { t } from './i18n';
import { useApp } from './store/app';
import { Home } from './ui/Home';
import { LessonScreen } from './ui/LessonScreen';

export function App() {
  const screen = useApp((s) => s.screen);
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto max-w-xl px-4 py-6">
        {screen.name === 'home' ? (
          <>
            <h1 className="text-2xl font-semibold">{t('app.title')}</h1>
            <p className="mt-1 text-stone-600 dark:text-stone-400">{t('app.tagline')}</p>
            <Home />
          </>
        ) : (
          <LessonScreen key={screen.lessonId} unitId={screen.unitId} lessonId={screen.lessonId} />
        )}
      </main>
    </div>
  );
}
