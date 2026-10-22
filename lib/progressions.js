/* База реальных прогрессий и лестница сложности. Без DOM.
   Токен аккорда: символ из Theory.CHORDS, опционально ":n" — обращение (n = 1..3). */
(function (root) {
  'use strict';

  const DIATONIC_MAJOR = ['1', '2', '3', '4', '5', '6', '7'];
  const DIATONIC_MINOR = ['1', '2', '♭3', '4', '5', '♭6', '♭7'];
  const ALL_MAJOR = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];
  const ALL_MINOR = ['1', '♭2', '2', '♭3', '♮3', '4', '♯4', '5', '♭6', '♮6', '♭7', '♮7'];

  const T_BASIC = ['piano'];
  const T_MID = ['piano', 'epiano', 'organ'];
  const T_ALL = ['piano', 'epiano', 'organ', 'strings', 'brass', 'pluck', 'flute'];

  /* keyHint: 'cadence' — полная каденция перед каждым вопросом;
              'tonic'   — только тонический аккорд;
              'block'   — каденция один раз на блок из blockSize вопросов в одной тональности. */
  const DEGREE_GROUPS = {
    major: [
      { title: 'Tonic triad', desc: 'Degrees 1, 3, 5 after the cadence', degrees: ['1', '3', '5'], keyHint: 'cadence', timbres: T_BASIC },
      { title: 'Pentachord', desc: 'Degrees 1–5', degrees: ['1', '2', '3', '4', '5'], keyHint: 'cadence', timbres: T_BASIC },
      { title: 'Full diatonic', desc: 'Seven degrees', degrees: DIATONIC_MAJOR, keyHint: 'cadence', timbres: T_MID },
      { title: 'A bit of chromatics', desc: '+ ♭7, ♯4, ♭3', degrees: DIATONIC_MAJOR.concat(['♭7', '♯4', '♭3']), keyHint: 'cadence', timbres: T_MID },
      { title: 'All 12 tones', desc: 'Diatonic + all alterations', degrees: ALL_MAJOR, keyHint: 'cadence', timbres: T_ALL },
      { title: 'Holding the tonic', desc: 'Cadence once per 8 questions, varied timbres', degrees: DIATONIC_MAJOR.concat(['♭7', '♯4']), keyHint: 'block', blockSize: 8, timbres: T_ALL },
    ],
    minor: [
      { title: 'Tonic triad', desc: 'Degrees 1, ♭3, 5 after the cadence', degrees: ['1', '♭3', '5'], keyHint: 'cadence', timbres: T_BASIC },
      { title: 'Pentachord', desc: 'Degrees 1–5', degrees: ['1', '2', '♭3', '4', '5'], keyHint: 'cadence', timbres: T_BASIC },
      { title: 'Natural minor', desc: 'Seven degrees', degrees: DIATONIC_MINOR, keyHint: 'cadence', timbres: T_MID },
      { title: 'Harmonic and melodic', desc: '+ ♮7 and ♮6', degrees: DIATONIC_MINOR.concat(['♮7', '♮6']), keyHint: 'cadence', timbres: T_MID },
      { title: 'All 12 tones', desc: 'All alterations', degrees: ALL_MINOR, keyHint: 'cadence', timbres: T_ALL },
      { title: 'Holding the tonic', desc: 'Cadence once per 8 questions, varied timbres', degrees: DIATONIC_MINOR.concat(['♮7', '♮6']), keyHint: 'block', blockSize: 8, timbres: T_ALL },
    ],
  };
  /* Каждая группа ступеней — четыре задачи: одна октава, разные октавы, в темпе (короткая каденция,
     ответ в течение FAST_ANSWER секунд), в темпе и в разных октавах. */
  const FAST_ANSWER = 2;
  const DEGREE_TASKS = [
    ['one', 'one octave', 'note in one octave', [0], false],
    ['oct', 'different octaves', 'note in three octaves', [-1, 0, 1], false],
    ['fast', 'in tempo', `short cadence, answer within ${FAST_ANSWER} s`, [0], true],
    ['fastoct', 'in tempo, different octaves', `three octaves, short cadence, answer within ${FAST_ANSWER} s`, [-1, 0, 1], true],
  ];
  const DEGREE_LEVELS = {};
  Object.keys(DEGREE_GROUPS).forEach(mode => {
    DEGREE_LEVELS[mode] = [];
    DEGREE_GROUPS[mode].forEach(g => DEGREE_TASKS.forEach(([task, tname, tdesc, octaves, fast]) =>
      DEGREE_LEVELS[mode].push(Object.assign({}, g, { title: `${g.title}: ${tname}`, group: g.title, short: tname, desc: `${g.desc} · ${tdesc}`, task, octaves, fast }))));
  });

  /* vocab — какие кнопки доступны для ответа на уровне (и какие аккорды разрешены в базе).
     chordDur — длительность аккорда в секундах. */
  const PROG_LEVELS = {
    major: [
      { title: 'Tonic, subdominant, dominant', desc: 'Two or three chords from I, IV, V', vocab: ['I', 'IV', 'V'], keyHint: 'cadence', chordDur: 1.2, timbres: T_BASIC },
      { title: 'Primary triads', desc: 'Four chords from I, IV, V', vocab: ['I', 'IV', 'V'], keyHint: 'cadence', chordDur: 1.1, timbres: T_BASIC },
      { title: 'Pop progressions', desc: '+ vi and ii', vocab: ['I', 'ii', 'IV', 'V', 'vi'], keyHint: 'cadence', chordDur: 1.0, timbres: T_MID },
      { title: 'Full diatonic', desc: '+ iii and vii°, longer chains', vocab: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], keyHint: 'cadence', chordDur: 0.9, timbres: T_MID },
      { title: 'Sevenths and inversions', desc: 'Jazz, soul; the bass is not always the root', vocab: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7', 'I7', 'Vsus4'], keyHint: 'tonic', chordDur: 0.85, timbres: T_ALL },
      { title: 'Chromatics', desc: 'Secondary dominants, borrowings from minor', vocab: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7', 'I7', 'Vsus4', 'V/ii', 'V/iii', 'V/IV', 'V/V', 'V/vi', 'iv', '♭III', '♭VI', '♭VII', 'vii°7'], keyHint: 'tonic', chordDur: 0.8, timbres: T_ALL },
    ],
    minor: [
      { title: 'Tonic, subdominant, dominant', desc: 'Two or three chords from i, iv, V', vocab: ['i', 'iv', 'V'], keyHint: 'cadence', chordDur: 1.2, timbres: T_BASIC },
      { title: 'Primary triads', desc: 'Four chords from i, iv, V', vocab: ['i', 'iv', 'V'], keyHint: 'cadence', chordDur: 1.1, timbres: T_BASIC },
      { title: 'Natural minor', desc: '+ III, VI, VII', vocab: ['i', 'III', 'iv', 'V', 'VI', 'VII'], keyHint: 'cadence', chordDur: 1.0, timbres: T_MID },
      { title: 'Full diatonic', desc: '+ ii°, minor v, Dorian IV', vocab: ['i', 'ii°', 'III', 'iv', 'IV', 'v', 'V', 'VI', 'VII'], keyHint: 'cadence', chordDur: 0.9, timbres: T_MID },
      { title: 'Sevenths and inversions', desc: 'Minor jazz; the bass is not always the root', vocab: ['i', 'ii°', 'III', 'iv', 'IV', 'v', 'V', 'VI', 'VII', 'i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'V7', 'VImaj7', 'VII7', 'vii°7'], keyHint: 'tonic', chordDur: 0.85, timbres: T_ALL },
      { title: 'Chromatics', desc: 'Secondary dominants, Neapolitan, Picardy third', vocab: ['i', 'ii°', 'III', 'iv', 'IV', 'v', 'V', 'VI', 'VII', 'i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'V7', 'VImaj7', 'VII7', 'vii°7', 'V/iv', 'V/V', 'V/VI', 'V/III', 'N', 'I'], keyHint: 'tonic', chordDur: 0.8, timbres: T_ALL },
    ],
  };

  const M = (level, chords, name, examples) => ({ mode: 'major', level, chords, name: name || '', examples: examples || [] });
  const m = (level, chords, name, examples) => ({ mode: 'minor', level, chords, name: name || '', examples: examples || [] });

  const PROGRESSIONS = [
    // ---------- МАЖОР ----------
    // Уровень 1
    M(1, ['I', 'IV']), M(1, ['I', 'V']), M(1, ['IV', 'I']), M(1, ['V', 'I']),
    M(1, ['I', 'IV', 'I'], 'Plagal cadence'), M(1, ['I', 'V', 'I'], 'Authentic cadence'),
    M(1, ['IV', 'V', 'I']), M(1, ['I', 'IV', 'V']),
    // Уровень 2
    M(2, ['I', 'IV', 'V', 'I'], 'Full cadence'),
    M(2, ['I', 'V', 'IV', 'I']),
    M(2, ['I', 'IV', 'I', 'V'], '', ['Van Morrison — Brown Eyed Girl']),
    M(2, ['I', 'IV', 'V', 'IV'], 'Three rock-and-roll chords', ['The Troggs — Wild Thing', 'The Kingsmen — Louie Louie']),
    M(2, ['I', 'IV', 'V', 'V'], '', ['Ritchie Valens — La Bamba', 'The Beatles — Twist and Shout']),
    M(2, ['I', 'V', 'I', 'IV']),
    M(2, ['IV', 'I', 'V', 'I']),
    M(2, ['I', 'I', 'IV', 'I', 'V', 'IV', 'I', 'V'], '12-bar blues (compressed)'),
    // Уровень 3
    M(3, ['I', 'V', 'vi', 'IV'], '"Four chords"', ['The Beatles — Let It Be (verse)', 'U2 — With or Without You', 'Journey — Don’t Stop Believin’', 'Adele — Someone Like You']),
    M(3, ['I', 'vi', 'IV', 'V'], '50s progression', ['Ben E. King — Stand by Me', 'The Police — Every Breath You Take', 'Ed Sheeran — Perfect']),
    M(3, ['vi', 'IV', 'I', 'V'], 'Pop progression from vi', ['The Cranberries — Zombie', 'Linkin Park — Numb', 'John Legend — All of Me', 'Luis Fonsi — Despacito']),
    M(3, ['I', 'vi', 'ii', 'V'], '"Heart and Soul" progression', ['Hoagy Carmichael — Heart and Soul', 'Rodgers & Hart — Blue Moon']),
    M(3, ['IV', 'V', 'I', 'vi'], '', ['Coldplay — Viva la Vida']),
    M(3, ['I', 'vi', 'V', 'IV'], '', ['John Denver — Take Me Home, Country Roads']),
    M(3, ['I', 'V', 'ii', 'I', 'V', 'IV'], '', ['Bob Dylan — Knockin’ on Heaven’s Door']),
    M(3, ['I', 'vi', 'I', 'vi', 'IV', 'V', 'I', 'V'], '', ['Leonard Cohen — Hallelujah (verse)']),
    M(3, ['ii', 'V', 'I'], 'II–V–I', ['any jazz standard']),
    M(3, ['I', 'IV', 'vi', 'V']),
    M(3, ['I', 'ii', 'IV', 'V']),
    M(3, ['vi', 'V', 'IV', 'V']),
    M(3, ['I', 'IV', 'ii', 'V']),
    // Уровень 4
    M(4, ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], "Pachelbel's Canon", ['Pachelbel — Canon in D', 'Green Day — Basket Case (verse)']),
    M(4, ['IV', 'V', 'iii', 'vi'], 'Royal Road (J-pop)'),
    M(4, ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'], 'Diatonic circle of fifths'),
    M(4, ['I', 'iii', 'IV', 'V']),
    M(4, ['I', 'iii', 'vi', 'IV']),
    M(4, ['vi', 'iii', 'IV', 'I']),
    M(4, ['I', 'ii', 'iii', 'IV']),
    M(4, ['I', 'vii°', 'vi', 'V']),
    M(4, ['I', 'V', 'vi', 'iii', 'IV']),
    M(4, ['ii', 'iii', 'IV', 'V']),
    // Уровень 5 — септаккорды и обращения
    M(5, ['ii7', 'V7', 'Imaj7'], 'II–V–I with seventh chords'),
    M(5, ['Imaj7', 'vi7', 'ii7', 'V7'], 'Rhythm changes (first bars)'),
    M(5, ['IVmaj7', 'V7', 'iii7', 'vi7'], 'Royal Road with seventh chords'),
    M(5, ['I', 'Imaj7', 'I7', 'IV'], 'Descending line on the tonic', ['The Beatles — Something']),
    M(5, ['I', 'Imaj7', 'IV', 'IV'], '', ['John Lennon — Imagine']),
    M(5, ['Imaj7', 'IVmaj7', 'Imaj7', 'IVmaj7'], 'Lo-fi'),
    M(5, ['I', 'IV', 'V7', 'I']),
    M(5, ['I', 'V:1', 'vi', 'iii:1', 'IV', 'I:1', 'IV', 'V'], 'Canon with descending bass'),
    M(5, ['I', 'V:1', 'vi', 'I:2', 'IV', 'I:1', 'ii', 'V'], 'Descending bass (scale)'),
    M(5, ['I', 'Vsus4', 'V', 'I']),
    M(5, ['I', 'iii7', 'vi7', 'ii7', 'V7']),
    M(5, ['vi7', 'ii7', 'V7', 'Imaj7']),
    M(5, ['I', 'IV:1', 'V', 'vi']),
    M(5, ['I', 'vi7', 'IVmaj7', 'V7']),
    M(5, ['viiø7', 'iii7', 'vi7', 'ii7', 'V7', 'Imaj7']),
    // Уровень 6 — хроматика
    M(6, ['I', 'V/vi', 'IV', 'iv'], '', ['Radiohead — Creep']),
    M(6, ['I', '♭VII', 'IV', 'I'], 'Mixolydian progression', ['The Beatles — Hey Jude (coda)']),
    M(6, ['I', '♭VI', '♭VII', 'I'], 'Epic progression (Mario cadence)'),
    M(6, ['I', 'V/V', 'V', 'I'], 'Double dominant'),
    M(6, ['I', 'V/IV', 'IV', 'iv', 'I'], 'Minor subdominant'),
    M(6, ['I', 'V/ii', 'ii', 'V', 'I']),
    M(6, ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'viiø7', 'V/vi', 'vi'], '', ['Bart Howard — Fly Me to the Moon']),
    M(6, ['I', 'V:1', 'IV:1', 'I:2', 'IV', 'I:1', 'V/V', 'V'], '', ['Billy Joel — Piano Man']),
    M(6, ['I', 'iv', 'I'], 'Minor plagal cadence'),
    M(6, ['I', '♭III', 'IV', 'I']),
    M(6, ['I', 'vii°7', 'I']),
    M(6, ['I', 'V/iii', 'iii', 'vi']),
    M(6, ['IV', 'iv', 'I', 'V']),
    M(6, ['I', 'V7', '♭VII', 'IV']),

    // ---------- МИНОР ----------
    // Уровень 1
    m(1, ['i', 'iv']), m(1, ['i', 'V']), m(1, ['iv', 'i']), m(1, ['V', 'i']),
    m(1, ['i', 'iv', 'i'], 'Plagal cadence'), m(1, ['i', 'V', 'i'], 'Authentic cadence'),
    m(1, ['iv', 'V', 'i']), m(1, ['i', 'iv', 'V']),
    // Уровень 2
    m(2, ['i', 'iv', 'V', 'i'], 'Full cadence'),
    m(2, ['i', 'V', 'iv', 'i']),
    m(2, ['i', 'iv', 'i', 'V']),
    m(2, ['i', 'iv', 'V', 'V'], '', ['Billie Eilish — bad guy']),
    m(2, ['i', 'V', 'i', 'iv']),
    m(2, ['iv', 'i', 'V', 'i']),
    m(2, ['i', 'iv', 'V', 'iv']),
    m(2, ['i', 'i', 'iv', 'i', 'V', 'iv', 'i', 'V'], 'Minor blues (compressed)'),
    // Уровень 3
    m(3, ['i', 'VI', 'III', 'VII'], 'Minor pop progression', ['The Cranberries — Zombie', 'Linkin Park — Numb', 'Toto — Africa (chorus)']),
    m(3, ['i', 'VII', 'VI', 'V'], 'Andalusian cadence', ['Ray Charles — Hit the Road Jack', 'Dire Straits — Sultans of Swing', 'Del Shannon — Runaway']),
    m(3, ['i', 'iv', 'III', 'VI'], '', ['Nirvana — Smells Like Teen Spirit']),
    m(3, ['i', 'III', 'VII', 'iv']),
    m(3, ['i', 'VI', 'V', 'V'], '', ['Eurythmics — Sweet Dreams']),
    m(3, ['i', 'III', 'VII', 'i'], '', ['Dolly Parton — Jolene']),
    m(3, ['i', 'VI', 'VII', 'i'], 'Aeolian progression'),
    m(3, ['i', 'VII', 'VI', 'VII']),
    m(3, ['i', 'iv', 'VII', 'III']),
    m(3, ['i', 'VI', 'iv', 'V']),
    m(3, ['VI', 'VII', 'i', 'i'], 'Aeolian cadence'),
    m(3, ['i', 'III', 'iv', 'V']),
    // Уровень 4
    m(4, ['i', 'III', 'IV', 'VI', 'i', 'III', 'V', 'V'], '', ['The Animals — House of the Rising Sun']),
    m(4, ['i', 'III', 'VII', 'IV'], '', ['Green Day — Boulevard of Broken Dreams', 'Gary Jules — Mad World']),
    m(4, ['i', 'v', 'VII', 'i'], '', ['Bill Withers — Ain’t No Sunshine']),
    m(4, ['i', 'VII', 'IV', 'IV'], 'Dorian progression', ['Chris Isaak — Wicked Game']),
    m(4, ['i', 'IV', 'i', 'IV'], 'Dorian vamp', ['The Doors — Riders on the Storm', 'Pink Floyd — Breathe']),
    m(4, ['i', 'ii°', 'V', 'i']),
    m(4, ['i', 'iv', 'v', 'i'], 'Natural minor without leading tone'),
    m(4, ['i', 'VI', 'ii°', 'V']),
    m(4, ['i', 'v', 'VI', 'VII']),
    m(4, ['i', 'VII', 'v', 'VI']),
    m(4, ['iv', 'V', 'i', 'VI']),
    m(4, ['i', 'III', 'ii°', 'V']),
    // Уровень 5
    m(5, ['iiø7', 'V7', 'i'], 'Minor II–V–I'),
    m(5, ['iv7', 'VII7', 'IIImaj7', 'VImaj7', 'iiø7', 'V7', 'i'], '', ['Joseph Kosma — Autumn Leaves']),
    m(5, ['i', 'V7', 'VII', 'IV', 'VI', 'III', 'iv', 'V7'], '', ['Eagles — Hotel California']),
    m(5, ['i7', 'iv7', 'V7', 'i7']),
    m(5, ['i', 'VImaj7', 'iiø7', 'V7']),
    m(5, ['i7', 'VII7', 'IIImaj7', 'VImaj7']),
    m(5, ['i', 'V:1', 'VI', 'III:1', 'iv', 'i:1', 'iiø7', 'V7'], 'Descending bass'),
    m(5, ['i', 'i:1', 'iv', 'V7']),
    m(5, ['i', 'VII:1', 'VI', 'V7']),
    m(5, ['i7', 'iv7', 'VII7', 'IIImaj7']),
    m(5, ['i', 'vii°7', 'i', 'V7']),
    m(5, ['iv7', 'V7', 'i', 'i']),
    m(5, ['i', 'v7', 'VI', 'V7']),
    // Уровень 6
    m(6, ['i', 'N', 'V', 'i'], 'Neapolitan progression'),
    m(6, ['i', 'V/iv', 'iv', 'V', 'i'], 'Secondary dominant of iv'),
    m(6, ['i', 'V/V', 'V', 'i'], 'Double dominant'),
    m(6, ['i', 'V/VI', 'VI', 'V7', 'i']),
    m(6, ['i', 'iv', 'V', 'I'], 'Picardy third'),
    m(6, ['i', 'VI', 'N', 'V']),
    m(6, ['i', 'V/III', 'III', 'VI', 'iiø7', 'V7', 'i']),
    m(6, ['i', 'V/iv', 'iv', 'N', 'V7', 'i']),
    m(6, ['iv', 'V/V', 'V', 'i']),
    m(6, ['i', 'VII', 'VI', 'V/V', 'V']),
    m(6, ['i', 'vii°7', 'i', 'N', 'V', 'I']),
  ];

  const Progressions = { DEGREE_GROUPS, DEGREE_LEVELS, FAST_ANSWER, PROG_LEVELS, PROGRESSIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Progressions;
  else root.Progressions = Progressions;
})(typeof window !== 'undefined' ? window : globalThis);
