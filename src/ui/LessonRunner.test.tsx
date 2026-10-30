import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Lesson } from '../content/schema';
import { FakeSpeaker } from '../audio/fake';
import { setSpeaker } from '../store/audio';
import { LessonRunner } from './LessonRunner';

afterEach(cleanup);

const lesson: Lesson = {
  id: 'a1-u01-l1',
  type: 'vocab',
  title: 'Test',
  exercises: [
    {
      id: 'a1-u01-l1-e1',
      type: 'multiple_choice',
      prompt: 'Was heißt „Hallo“?',
      options: ['Merhaba', 'Hayır'],
      answer: 'Merhaba',
    },
    {
      id: 'a1-u01-l1-e2',
      type: 'free_text',
      direction: 'de_tr',
      prompt: 'Danke',
      answers: ['Teşekkürler'],
      hint: '„Sağ ol“ ist informell.',
    },
  ],
};

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('LessonRunner', () => {
  it('führt durch die Lektion, wiederholt Fehler und zeigt das Ergebnis', () => {
    const onExit = vi.fn();
    render(<LessonRunner lesson={lesson} onExit={onExit} />);

    // MC falsch → Feedback mit Lösung, Wiederholung angekündigt
    fireEvent.click(screen.getByLabelText(/Hayır/));
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Leider falsch.');
    expect(screen.getByRole('status').textContent).toContain('Lösung: Merhaba');
    expect(screen.getByRole('status').textContent).toContain('noch einmal');
    click('Weiter');

    // Freitext mit Sonderzeichen-Leiste
    const input = screen.getByLabelText('Deine Antwort');
    fireEvent.change(input, { target: { value: 'Te' } });
    click('ş einfügen');
    fireEvent.change(input, { target: { value: 'Teşekkürler' } });
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
    click('Weiter');

    // Wiederholung der MC-Aufgabe
    fireEvent.click(screen.getByLabelText(/Merhaba/));
    click('Prüfen');
    click('Weiter');

    expect(screen.getByRole('heading', { name: 'Lektion geschafft' })).toBeTruthy();
    expect(screen.getByText('1 von 2 beim ersten Versuch richtig')).toBeTruthy();
    click('Zur Übersicht');
    expect(onExit).toHaveBeenCalled();
  });

  it('meldet Versuche einmal je Übung und den Abschluss genau einmal', () => {
    const onAttempt = vi.fn();
    const onComplete = vi.fn();
    render(
      <LessonRunner
        lesson={lesson}
        onExit={() => {}}
        onAttempt={onAttempt}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByLabelText(/Hayır/)); // falsch
    click('Prüfen');
    click('Weiter');
    fireEvent.change(screen.getByLabelText('Deine Antwort'), { target: { value: 'Teşekkürler' } });
    click('Prüfen');
    click('Weiter');
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Merhaba/)); // Wiederholung der MC-Aufgabe
    click('Prüfen');
    click('Weiter');

    expect(onAttempt.mock.calls.map(([ex, verdict]) => [ex.id, verdict])).toEqual([
      ['a1-u01-l1-e1', 'wrong'],
      ['a1-u01-l1-e2', 'correct'],
    ]); // Wiederholung wird nicht als neuer Versuch gezählt
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(1, 2);
  });

  it('attemptOnce: „Nochmal“ meldet keinen weiteren Versuch', () => {
    const onAttempt = vi.fn();
    render(<LessonRunner lesson={lesson} onExit={() => {}} onAttempt={onAttempt} attemptOnce />);
    fireEvent.click(screen.getByLabelText(/Hayır/));
    click('Prüfen');
    click('Weiter');
    fireEvent.change(screen.getByLabelText('Deine Antwort'), { target: { value: 'Teşekkürler' } });
    click('Prüfen');
    click('Weiter');
    fireEvent.click(screen.getByLabelText(/Hayır/)); // Wiederholung, wieder falsch
    click('Prüfen');
    click('Weiter');
    expect(onAttempt).toHaveBeenCalledTimes(2);

    click('Nochmal');
    fireEvent.click(screen.getByLabelText(/Hayır/));
    click('Prüfen');
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it('reportFor: „Fehler melden“ auch ohne feste Unit, mit Prüfstand', () => {
    render(
      <LessonRunner
        lesson={lesson}
        onExit={() => {}}
        reportFor={(ex) => ({ unitId: 'a1-u01', unreviewed: ex.id.endsWith('e1') })}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Merhaba/));
    click('Prüfen');
    expect(screen.getByText('Noch nicht geprüft')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Fehler melden/ })).toBeTruthy();
  });

  it('erlaubt Prüfen erst mit Antwort', () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Prüfen' }).hasAttribute('disabled')).toBe(true);
  });

  it('prüft mit Enter, auch wenn der angetippte Baustein den Fokus hält', () => {
    const wb: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e9',
          type: 'word_bank',
          prompt: 'Guten Morgen!',
          answers: ['Günaydın!'],
          distractors: ['İyi'],
        },
      ],
    };
    render(<LessonRunner lesson={wb} onExit={() => {}} />);
    const tile = screen.getByRole('button', { name: 'Günaydın' });
    fireEvent.click(tile);
    expect(tile.hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(tile, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it('baut Wortformen im Suffix-Builder und begründet die Regel', () => {
    const sbLesson: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e8',
          type: 'suffix_builder',
          stem: 'kitap',
          suffixes: ['ACC'],
          target: 'kitabı',
          gloss_de: 'das Buch',
        },
      ],
    };
    const vocab = [{ tr: 'kitap', de: ['Buch'], pos: 'noun' as const, softens: true }];
    render(<LessonRunner lesson={sbLesson} vocab={vocab} onExit={() => {}} />);
    expect(screen.getByText('kitap + Akkusativ')).toBeTruthy();
    // erst falsch (ungeänderter Stamm), dann richtig nach Wiederholung
    fireEvent.click(screen.getByRole('button', { name: 'kitap' }));
    fireEvent.click(screen.getByRole('button', { name: 'ı' }));
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Lösung: kitabı');
    expect(screen.getByRole('status').textContent).toContain(
      'Auslaut „p“ wird vor einem Vokal zu „b“',
    );
    click('Weiter');
    fireEvent.click(screen.getByRole('button', { name: 'kitab' }));
    fireEvent.click(screen.getByRole('button', { name: 'ı' }));
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it('Konjugation: verneinte Form bauen und Verengung begründen', () => {
    const conjLesson: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e7',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'gelmek',
          person: '1sg',
          negative: true,
          target: 'gelmiyorum',
          gloss_de: 'ich komme nicht',
        },
      ],
    };
    render(<LessonRunner lesson={conjLesson} onExit={() => {}} />);
    expect(screen.getByText('gelmek · ich · verneint')).toBeTruthy();
    for (const tile of ['gel', 'mi', 'yor', 'um']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Richtig!');
    expect(status).toContain('Vor -yor wird die Verneinung -me/-ma zu „mi“');
  });

  it('Konjugation mit idi: Formel nennt Präsens und Kopula', () => {
    const compound: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e4',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'gelmek',
          person: '1sg',
          tense: 'present',
          compound: 'past',
          target: 'geliyordum',
          gloss_de: 'ich kam gerade',
        },
      ],
    };
    render(<LessonRunner lesson={compound} onExit={() => {}} />);
    expect(screen.getByText('gelmek · ich · Präsens · mit idi (-di)')).toBeTruthy();
    for (const tile of ['gel', 'iyor', 'du', 'm']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it('Suffix-Builder mit Partizip: Verb, Partizip und Endung bauen', () => {
    const verbal: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e3',
          type: 'suffix_builder',
          stem: 'okumak',
          verbal: 'PART_DIK',
          suffixes: ['POSS_1SG'],
          target: 'okuduğum',
          gloss_de: 'was ich gelesen habe',
        },
      ],
    };
    render(<LessonRunner lesson={verbal} onExit={() => {}} />);
    expect(screen.getByText('okumak + Partizip -dik + mein')).toBeTruthy();
    for (const tile of ['oku', 'duğ', 'um']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it.each([
    [
      { tense: 'optative', person: '1pl', target: 'gelelim' },
      'gelmek · wir · Optativ (-eyim/-elim)',
    ],
    [{ tense: 'conditional', target: 'gelsem' }, 'gelmek · ich · Konditional (-se)'],
    [
      { tense: 'aorist', compound: 'conditional', target: 'gelirsem' },
      'gelmek · ich · Aorist · mit ise (-se)',
    ],
    [
      { tense: 'present', compound: 'evidential', target: 'geliyormuşum' },
      'gelmek · ich · Präsens · mit imiş (-miş)',
    ],
  ] as const)('Konjugationsformel %o', (extra, formula) => {
    const one: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e1',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'gelmek',
          person: '1sg',
          ...extra,
        } as Lesson['exercises'][number],
      ],
    };
    render(<LessonRunner lesson={one} onExit={() => {}} />);
    expect(screen.getByText(formula)).toBeTruthy();
  });

  it('Suffix-Builder: verneintes Können heißt -eme, nicht -ebil + Verneinung', () => {
    const cannot: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e1',
          type: 'suffix_builder',
          stem: 'gelmek',
          verbal: 'PART_AN',
          ability: true,
          negative: true,
          suffixes: [],
          target: 'gelemeyen',
        },
      ],
    };
    render(<LessonRunner lesson={cannot} onExit={() => {}} />);
    expect(screen.getByText('gelmek + nicht können -eme + Partizip -en')).toBeTruthy();
    for (const tile of ['gel', 'e', 'me', 'yen']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it('Tabelle mit Partizip nennt Passiv in der Formel', () => {
    const table: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e2',
          type: 'paradigm',
          kind: 'verbal',
          verbal: 'PART_DIK',
          lemma: 'yapmak',
          passive: true,
          rows: [['POSS_1SG'], ['POSS_3SG']],
          targets: ['yapıldığım', 'yapıldığı'],
        },
      ],
    };
    render(<LessonRunner lesson={table} onExit={() => {}} />);
    expect(screen.getByText('yapmak · Passiv · Partizip -dik')).toBeTruthy();
    const cells = screen.getAllByRole('textbox');
    fireEvent.change(cells[0]!, { target: { value: 'yapıldığım' } });
    fireEvent.change(cells[1]!, { target: { value: 'yapıldığı' } });
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it('Konjugation im Präteritum: Zeit in der Formel, Begründung der Angleichung', () => {
    const past: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e5',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'yapmak',
          person: '1sg',
          tense: 'past',
          target: 'yaptım',
          gloss_de: 'ich habe gemacht',
        },
      ],
    };
    render(<LessonRunner lesson={past} onExit={() => {}} />);
    expect(screen.getByText('yapmak · ich · Präteritum')).toBeTruthy();
    for (const tile of ['yap', 'tı', 'm']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Richtig!');
    expect(status).toContain('Nach stimmlosem „p“ wird d zu t');
  });

  it('Konjugation mit „können“: Formel und Begründung des Aorist-Vokals', () => {
    const ability: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e4',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'gelmek',
          person: '1sg',
          tense: 'aorist',
          ability: true,
          target: 'gelebilirim',
        },
      ],
    };
    render(<LessonRunner lesson={ability} onExit={() => {}} />);
    expect(screen.getByText('gelmek · ich · können · Aorist')).toBeTruthy();
    for (const tile of ['gel', 'ebil', 'ir', 'im']) {
      fireEvent.click(screen.getByRole('button', { name: tile }));
    }
    click('Prüfen');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Richtig!');
    expect(status).toContain('-ebil endet auf bil');
  });

  it('Tabelle: markiert falsche Zellen und begründet nur diese', () => {
    const parLesson: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e6',
          type: 'paradigm',
          kind: 'noun',
          lemma: 'park',
          rows: [['LOC'], ['DAT'], ['ABL']],
          targets: ['parkta', 'parka', 'parktan'],
        },
      ],
    };
    render(<LessonRunner lesson={parLesson} onExit={() => {}} />);
    const check = screen.getByRole('button', { name: 'Prüfen' });
    fireEvent.change(screen.getByLabelText('Lokativ'), { target: { value: 'parkda' } });
    fireEvent.change(screen.getByLabelText('Dativ'), { target: { value: 'parka' } });
    expect(check.hasAttribute('disabled')).toBe(true); // noch ein Feld leer
    fireEvent.change(screen.getByLabelText('Ablativ'), { target: { value: 'parktan' } });
    click('Prüfen');
    const status = screen.getByRole('status').textContent;
    expect(status).toContain('Leider falsch.');
    expect(status).toContain('Lokativ');
    expect(status).not.toContain('Ablativ');
    expect(screen.getByText('✗ richtig: parkta')).toBeTruthy();
    expect(screen.getByLabelText('Dativ').getAttribute('aria-invalid')).toBe('false');
  });

  it('wählt MC-Optionen per Zifferntaste und prüft mit Enter', () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });
});

describe('LessonRunner Grammatik-Hinweis', () => {
  const section = { title: 'Begrüßen', body: '- **Merhaba** – Hallo' };

  it('zeigt den Abschnitt der Erklärkarte nur nach einer falschen Antwort', () => {
    const grammarFor = vi.fn(() => section);
    render(<LessonRunner lesson={lesson} onExit={() => {}} grammarFor={grammarFor} />);
    fireEvent.click(screen.getByLabelText(/Hayır/));
    click('Prüfen');
    expect(screen.getByText('Grammatik: Begrüßen')).toBeTruthy();
    expect(screen.getByText('Merhaba', { selector: 'strong' })).toBeTruthy();
    click('Weiter');

    fireEvent.change(screen.getByLabelText('Deine Antwort'), { target: { value: 'Teşekkürler' } });
    click('Prüfen');
    expect(screen.queryByText('Grammatik: Begrüßen')).toBeNull();
  });

  describe('Hörübungen', () => {
    const listening: Lesson = {
      id: 'a1-u01-h1',
      type: 'listening',
      title: 'Hören',
      exercises: [
        {
          id: 'a1-u01-h1-e1',
          type: 'listen',
          mode: 'dictation',
          text: 'Günaydın',
          gloss_de: 'Guten Morgen',
        },
        {
          id: 'a1-u01-h1-e2',
          type: 'listen',
          mode: 'meaning',
          text: 'Merhaba',
          options: ['Hallo', 'Danke'],
          answer: 'Hallo',
        },
      ],
    };

    it('mit Stimme: Diktat lösen, Text erscheint erst nach der Antwort', () => {
      const speaker = new FakeSpeaker('ready');
      setSpeaker(speaker);
      render(<LessonRunner lesson={listening} onExit={() => {}} />);
      expect(screen.queryByText('Günaydın')).toBeNull();
      click('Anhören');
      expect(speaker.spoken).toEqual([{ text: 'Günaydın', rate: 'normal' }]);
      fireEvent.change(screen.getByLabelText('Deine Antwort'), { target: { value: 'günaydin' } });
      click('Prüfen');
      expect(screen.getAllByText('Günaydın').length).toBeGreaterThan(0);
      expect(screen.getByText('„Guten Morgen“')).toBeTruthy();
    });

    it('Verlassen bricht eine laufende Ansage ab', () => {
      const speaker = new FakeSpeaker('ready');
      setSpeaker(speaker);
      const { unmount } = render(<LessonRunner lesson={listening} onExit={() => {}} />);
      const before = speaker.cancelled;
      unmount();
      expect(speaker.cancelled).toBeGreaterThan(before);
    });

    it('ohne Stimme: Hörübungen fehlen im Durchgang', () => {
      setSpeaker(new FakeSpeaker('no-voice'));
      render(<LessonRunner lesson={listening} onExit={() => {}} />);
      expect(screen.getByRole('heading', { name: /brauchen eine türkische Stimme/ })).toBeTruthy();
    });

    it('Jetzt nicht hören beendet ohne Abschluss und ohne Versuch', () => {
      setSpeaker(new FakeSpeaker('ready'));
      const onAttempt = vi.fn();
      const onComplete = vi.fn();
      render(
        <LessonRunner
          lesson={listening}
          onExit={() => {}}
          onAttempt={onAttempt}
          onComplete={onComplete}
        />,
      );
      click('Jetzt nicht hören');
      expect(screen.getByRole('heading', { name: 'Übersprungen' })).toBeTruthy();
      expect(onAttempt).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});

describe('LessonRunner Zerlegen und Satzbau', () => {
  const structure: Lesson = {
    id: 'a1-u03-z1',
    type: 'segmenting',
    title: 'Wörter zerlegen',
    exercises: [
      {
        id: 'a1-u03-z1-l2-e1',
        type: 'segment',
        word: 'evlerden',
        segments: [
          { text: 'ev', tag: 'STEM' },
          { text: 'ler', tag: 'PL' },
          { text: 'den', tag: 'ABL' },
        ],
        analysis: { kind: 'noun', lemma: 'ev', tags: ['PL', 'ABL'] },
        from: 'a1-u03-l2-e1',
        gloss_de: 'aus den Häusern',
      },
      {
        id: 'a1-u08-s1-l5-e5',
        type: 'sov_puzzle',
        prompt: 'Was machst du jetzt?',
        text: 'Şimdi ne yapıyorsun?',
        chunks: [
          { text: 'şimdi', role: 'time' },
          { text: 'ne', role: 'question' },
          { text: 'yapıyorsun', role: 'predicate' },
        ],
        orders: [{ order: [1, 2, 0], note: 'Nachtrag hinter dem Verb.' }],
      },
    ],
  };
  const vocab = [{ tr: 'ev', de: ['Haus'], pos: 'noun' as const }];

  it('Zerlegen: Grenzen antippen, Rollen wählen, Begründung im Feedback', () => {
    render(<LessonRunner lesson={structure} vocab={vocab} onExit={() => {}} />);
    const prufen = () => screen.getByRole('button', { name: 'Prüfen' }) as HTMLButtonElement;
    expect(screen.getByText('„aus den Häusern“')).toBeTruthy();
    click('Grenze nach „ev“');
    click('Grenze nach „evler“');
    expect(
      screen.getByRole('button', { name: 'Grenze nach „ev“' }).getAttribute('aria-pressed'),
    ).toBe('true');
    // Ohne Rollen noch keine Antwort
    expect(prufen().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Rolle von Teil 2 („ler“)'), {
      target: { value: 'ABL' },
    });
    fireEvent.change(screen.getByLabelText('Rolle von Teil 3 („den“)'), {
      target: { value: 'PL' },
    });
    expect(prufen().disabled).toBe(false);
    click('Prüfen');
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Leider falsch.');
    expect(status.textContent).toContain('ev-ler-den');
    expect(status.textContent).toContain('Ablativ');
    expect(status.textContent).toContain('Warum?');
  });

  it('Satzbau: Satzglieder ordnen, Variante mit Hinweis, Rollen im Feedback', () => {
    const second: Lesson = { ...structure, exercises: [structure.exercises[1]!] };
    render(<LessonRunner lesson={second} onExit={() => {}} />);
    expect(screen.getByText('Was machst du jetzt?')).toBeTruthy();
    click('ne');
    click('yapıyorsun');
    click('şimdi');
    click('Prüfen');
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Richtig!');
    expect(status.textContent).toContain('Nachtrag hinter dem Verb.');
    expect(status.textContent).toContain('Fragewort');
  });

  it('Satzbau: falsche Reihenfolge mit Regelhinweis', () => {
    const second: Lesson = { ...structure, exercises: [structure.exercises[1]!] };
    render(<LessonRunner lesson={second} onExit={() => {}} />);
    click('ne');
    click('şimdi');
    click('yapıyorsun');
    click('Prüfen');
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Leider falsch.');
    expect(status.textContent).toContain('Lösung: Şimdi ne yapıyorsun?');
    expect(status.textContent).toContain('direkt vor dem Verb');
  });
});

describe('LessonRunner B2-Formeln', () => {
  const one = (ex: object): Lesson => ({
    id: 'b2-u01-l1',
    type: 'grammar',
    title: 'Test',
    exercises: [{ id: 'b2-u01-l1-e1', ...ex } as Lesson['exercises'][number]],
  });
  const tiles = (names: string[]) => {
    for (const name of names) fireEvent.click(screen.getByRole('button', { name }));
    click('Prüfen');
    return screen.getByRole('status').textContent;
  };

  it('Kausativ: Formel nennt ihn vor dem Passiv, Begründung im Feedback', () => {
    render(
      <LessonRunner
        lesson={one({
          type: 'conjugation',
          mode: 'verb',
          lemma: 'yapmak',
          person: '3sg',
          tense: 'aorist',
          causative: true,
          passive: true,
          target: 'yaptırılır',
        })}
        onExit={() => {}}
      />,
    );
    expect(screen.getByText('yapmak · er/sie/es · Kausativ · Passiv · Aorist')).toBeTruthy();
    const status = tiles(['yap', 'tır', 'ıl', 'ır']);
    expect(status).toContain('Richtig!');
    expect(status).toContain('Kausativ nach Konsonant: -tır');
  });

  it('-mekte mit -dir am Verb', () => {
    render(
      <LessonRunner
        lesson={one({
          type: 'conjugation',
          mode: 'verb',
          lemma: 'gelmek',
          person: '3sg',
          tense: 'mekte',
          dir: true,
          target: 'gelmektedir',
        })}
        onExit={() => {}}
      />,
    );
    expect(screen.getByText('gelmek · er/sie/es · Verlauf (-mekte) · Endung -dir')).toBeTruthy();
    expect(tiles(['gel', 'mekte', 'dir'])).toContain('Richtig!');
  });

  it('Suffix-Builder: Kausativ + infinite Form', () => {
    render(
      <LessonRunner
        lesson={one({
          type: 'suffix_builder',
          stem: 'yapmak',
          verbal: 'CV_DIKCA',
          suffixes: [],
          causative: true,
          target: 'yaptırdıkça',
        })}
        onExit={() => {}}
      />,
    );
    expect(screen.getByText(/yapmak \+ Kausativ \+ je mehr, immer wenn/)).toBeTruthy();
    expect(tiles(['yap', 'tır', 'dıkça'])).toContain('Richtig!');
  });
});
