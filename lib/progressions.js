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
  const DEGREE_LEVELS = {
    major: [
      { title: 'Тоническое трезвучие', desc: 'Ступени 1, 3, 5 после каденции', degrees: ['1', '3', '5'], keyHint: 'cadence', octaves: [0], timbres: T_BASIC },
      { title: 'Пентахорд', desc: 'Ступени 1–5', degrees: ['1', '2', '3', '4', '5'], keyHint: 'cadence', octaves: [0], timbres: T_BASIC },
      { title: 'Вся диатоника', desc: 'Семь ступеней, разные тембры', degrees: DIATONIC_MAJOR, keyHint: 'cadence', octaves: [0], timbres: T_MID },
      { title: 'Немного хроматики', desc: '+ ♭7, ♯4, ♭3', degrees: DIATONIC_MAJOR.concat(['♭7', '♯4', '♭3']), keyHint: 'cadence', octaves: [0], timbres: T_MID },
      { title: 'Все 12 звуков', desc: 'Диатоника + все альтерации', degrees: ALL_MAJOR, keyHint: 'cadence', octaves: [0, 1], timbres: T_ALL },
      { title: 'Удержание тоники', desc: 'Каденция один раз на 8 вопросов, разные октавы и тембры', degrees: DIATONIC_MAJOR.concat(['♭7', '♯4']), keyHint: 'block', blockSize: 8, octaves: [-1, 0, 1], timbres: T_ALL },
    ],
    minor: [
      { title: 'Тоническое трезвучие', desc: 'Ступени 1, ♭3, 5 после каденции', degrees: ['1', '♭3', '5'], keyHint: 'cadence', octaves: [0], timbres: T_BASIC },
      { title: 'Пентахорд', desc: 'Ступени 1–5', degrees: ['1', '2', '♭3', '4', '5'], keyHint: 'cadence', octaves: [0], timbres: T_BASIC },
      { title: 'Натуральный минор', desc: 'Семь ступеней, разные тембры', degrees: DIATONIC_MINOR, keyHint: 'cadence', octaves: [0], timbres: T_MID },
      { title: 'Гармонический и мелодический', desc: '+ ♮7 и ♮6', degrees: DIATONIC_MINOR.concat(['♮7', '♮6']), keyHint: 'cadence', octaves: [0], timbres: T_MID },
      { title: 'Все 12 звуков', desc: 'Все альтерации', degrees: ALL_MINOR, keyHint: 'cadence', octaves: [0, 1], timbres: T_ALL },
      { title: 'Удержание тоники', desc: 'Каденция один раз на 8 вопросов, разные октавы и тембры', degrees: DIATONIC_MINOR.concat(['♮7', '♮6']), keyHint: 'block', blockSize: 8, octaves: [-1, 0, 1], timbres: T_ALL },
    ],
  };

  /* vocab — какие кнопки доступны для ответа на уровне (и какие аккорды разрешены в базе).
     chordDur — длительность аккорда в секундах. */
  const PROG_LEVELS = {
    major: [
      { title: 'Тоника, субдоминанта, доминанта', desc: 'Два-три аккорда из I, IV, V', vocab: ['I', 'IV', 'V'], keyHint: 'cadence', chordDur: 1.2, timbres: T_BASIC },
      { title: 'Главные трезвучия', desc: 'Четыре аккорда из I, IV, V', vocab: ['I', 'IV', 'V'], keyHint: 'cadence', chordDur: 1.1, timbres: T_BASIC },
      { title: 'Поп-прогрессии', desc: '+ vi и ii', vocab: ['I', 'ii', 'IV', 'V', 'vi'], keyHint: 'cadence', chordDur: 1.0, timbres: T_MID },
      { title: 'Вся диатоника', desc: '+ iii и vii°, длинные цепочки', vocab: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], keyHint: 'cadence', chordDur: 0.9, timbres: T_MID },
      { title: 'Септаккорды и обращения', desc: 'Джаз, соул; бас не всегда основной тон', vocab: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7', 'I7', 'Vsus4'], keyHint: 'tonic', chordDur: 0.85, timbres: T_ALL },
      { title: 'Хроматика', desc: 'Побочные доминанты, заимствования из минора', vocab: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7', 'I7', 'Vsus4', 'V/ii', 'V/iii', 'V/IV', 'V/V', 'V/vi', 'iv', '♭III', '♭VI', '♭VII', 'vii°7'], keyHint: 'tonic', chordDur: 0.8, timbres: T_ALL },
    ],
    minor: [
      { title: 'Тоника, субдоминанта, доминанта', desc: 'Два-три аккорда из i, iv, V', vocab: ['i', 'iv', 'V'], keyHint: 'cadence', chordDur: 1.2, timbres: T_BASIC },
      { title: 'Главные трезвучия', desc: 'Четыре аккорда из i, iv, V', vocab: ['i', 'iv', 'V'], keyHint: 'cadence', chordDur: 1.1, timbres: T_BASIC },
      { title: 'Натуральный минор', desc: '+ III, VI, VII', vocab: ['i', 'III', 'iv', 'V', 'VI', 'VII'], keyHint: 'cadence', chordDur: 1.0, timbres: T_MID },
      { title: 'Полная диатоника', desc: '+ ii°, минорная v, дорийская IV', vocab: ['i', 'ii°', 'III', 'iv', 'IV', 'v', 'V', 'VI', 'VII'], keyHint: 'cadence', chordDur: 0.9, timbres: T_MID },
      { title: 'Септаккорды и обращения', desc: 'Минорный джаз, бас не всегда основной тон', vocab: ['i', 'ii°', 'III', 'iv', 'IV', 'v', 'V', 'VI', 'VII', 'i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'V7', 'VImaj7', 'VII7', 'vii°7'], keyHint: 'tonic', chordDur: 0.85, timbres: T_ALL },
      { title: 'Хроматика', desc: 'Побочные доминанты, неаполитанский, пикардийская терция', vocab: ['i', 'ii°', 'III', 'iv', 'IV', 'v', 'V', 'VI', 'VII', 'i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'V7', 'VImaj7', 'VII7', 'vii°7', 'V/iv', 'V/V', 'V/VI', 'V/III', 'N', 'I'], keyHint: 'tonic', chordDur: 0.8, timbres: T_ALL },
    ],
  };

  const M = (level, chords, name, examples) => ({ mode: 'major', level, chords, name: name || '', examples: examples || [] });
  const m = (level, chords, name, examples) => ({ mode: 'minor', level, chords, name: name || '', examples: examples || [] });

  const PROGRESSIONS = [
    // ---------- МАЖОР ----------
    // Уровень 1
    M(1, ['I', 'IV']), M(1, ['I', 'V']), M(1, ['IV', 'I']), M(1, ['V', 'I']),
    M(1, ['I', 'IV', 'I'], 'Плагальный оборот'), M(1, ['I', 'V', 'I'], 'Автентический оборот'),
    M(1, ['IV', 'V', 'I']), M(1, ['I', 'IV', 'V']),
    // Уровень 2
    M(2, ['I', 'IV', 'V', 'I'], 'Полная каденция'),
    M(2, ['I', 'V', 'IV', 'I']),
    M(2, ['I', 'IV', 'I', 'V'], '', ['Van Morrison — Brown Eyed Girl']),
    M(2, ['I', 'IV', 'V', 'IV'], 'Три аккорда рок-н-ролла', ['The Troggs — Wild Thing', 'The Kingsmen — Louie Louie']),
    M(2, ['I', 'IV', 'V', 'V'], '', ['Ritchie Valens — La Bamba', 'The Beatles — Twist and Shout']),
    M(2, ['I', 'V', 'I', 'IV']),
    M(2, ['IV', 'I', 'V', 'I']),
    M(2, ['I', 'I', 'IV', 'I', 'V', 'IV', 'I', 'V'], '12-тактовый блюз (сжатый)'),
    // Уровень 3
    M(3, ['I', 'V', 'vi', 'IV'], '«Четыре аккорда»', ['The Beatles — Let It Be (куплет)', 'U2 — With or Without You', 'Journey — Don’t Stop Believin’', 'Adele — Someone Like You']),
    M(3, ['I', 'vi', 'IV', 'V'], 'Оборот 50-х', ['Ben E. King — Stand by Me', 'The Police — Every Breath You Take', 'Ed Sheeran — Perfect']),
    M(3, ['vi', 'IV', 'I', 'V'], 'Поп-оборот от vi', ['The Cranberries — Zombie', 'Linkin Park — Numb', 'John Legend — All of Me', 'Luis Fonsi — Despacito']),
    M(3, ['I', 'vi', 'ii', 'V'], 'Оборот «Heart and Soul»', ['Hoagy Carmichael — Heart and Soul', 'Rodgers & Hart — Blue Moon']),
    M(3, ['IV', 'V', 'I', 'vi'], '', ['Coldplay — Viva la Vida']),
    M(3, ['I', 'vi', 'V', 'IV'], '', ['John Denver — Take Me Home, Country Roads']),
    M(3, ['I', 'V', 'ii', 'I', 'V', 'IV'], '', ['Bob Dylan — Knockin’ on Heaven’s Door']),
    M(3, ['I', 'vi', 'I', 'vi', 'IV', 'V', 'I', 'V'], '', ['Leonard Cohen — Hallelujah (куплет)']),
    M(3, ['ii', 'V', 'I'], 'II–V–I', ['любой джазовый стандарт']),
    M(3, ['I', 'IV', 'vi', 'V']),
    M(3, ['I', 'ii', 'IV', 'V']),
    M(3, ['vi', 'V', 'IV', 'V']),
    M(3, ['I', 'IV', 'ii', 'V']),
    // Уровень 4
    M(4, ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], 'Канон Пахельбеля', ['Pachelbel — Canon in D', 'Green Day — Basket Case (куплет)']),
    M(4, ['IV', 'V', 'iii', 'vi'], 'Royal Road (J-pop)'),
    M(4, ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'], 'Диатонический круг квинт'),
    M(4, ['I', 'iii', 'IV', 'V']),
    M(4, ['I', 'iii', 'vi', 'IV']),
    M(4, ['vi', 'iii', 'IV', 'I']),
    M(4, ['I', 'ii', 'iii', 'IV']),
    M(4, ['I', 'vii°', 'vi', 'V']),
    M(4, ['I', 'V', 'vi', 'iii', 'IV']),
    M(4, ['ii', 'iii', 'IV', 'V']),
    // Уровень 5 — септаккорды и обращения
    M(5, ['ii7', 'V7', 'Imaj7'], 'II–V–I с септаккордами'),
    M(5, ['Imaj7', 'vi7', 'ii7', 'V7'], 'Rhythm changes (первые такты)'),
    M(5, ['IVmaj7', 'V7', 'iii7', 'vi7'], 'Royal Road с септаккордами'),
    M(5, ['I', 'Imaj7', 'I7', 'IV'], 'Нисходящая линия в тонике', ['The Beatles — Something']),
    M(5, ['I', 'Imaj7', 'IV', 'IV'], '', ['John Lennon — Imagine']),
    M(5, ['Imaj7', 'IVmaj7', 'Imaj7', 'IVmaj7'], 'Lo-fi'),
    M(5, ['I', 'IV', 'V7', 'I']),
    M(5, ['I', 'V:1', 'vi', 'iii:1', 'IV', 'I:1', 'IV', 'V'], 'Канон с нисходящим басом'),
    M(5, ['I', 'V:1', 'vi', 'I:2', 'IV', 'I:1', 'ii', 'V'], 'Нисходящий бас (гамма)'),
    M(5, ['I', 'Vsus4', 'V', 'I']),
    M(5, ['I', 'iii7', 'vi7', 'ii7', 'V7']),
    M(5, ['vi7', 'ii7', 'V7', 'Imaj7']),
    M(5, ['I', 'IV:1', 'V', 'vi']),
    M(5, ['I', 'vi7', 'IVmaj7', 'V7']),
    M(5, ['viiø7', 'iii7', 'vi7', 'ii7', 'V7', 'Imaj7']),
    // Уровень 6 — хроматика
    M(6, ['I', 'V/vi', 'IV', 'iv'], '', ['Radiohead — Creep']),
    M(6, ['I', '♭VII', 'IV', 'I'], 'Миксолидийский оборот', ['The Beatles — Hey Jude (кода)']),
    M(6, ['I', '♭VI', '♭VII', 'I'], 'Эпический оборот (Mario cadence)'),
    M(6, ['I', 'V/V', 'V', 'I'], 'Двойная доминанта'),
    M(6, ['I', 'V/IV', 'IV', 'iv', 'I'], 'Минорная субдоминанта'),
    M(6, ['I', 'V/ii', 'ii', 'V', 'I']),
    M(6, ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'viiø7', 'V/vi', 'vi'], '', ['Bart Howard — Fly Me to the Moon']),
    M(6, ['I', 'V:1', 'IV:1', 'I:2', 'IV', 'I:1', 'V/V', 'V'], '', ['Billy Joel — Piano Man']),
    M(6, ['I', 'iv', 'I'], 'Минорный плагальный оборот'),
    M(6, ['I', '♭III', 'IV', 'I']),
    M(6, ['I', 'vii°7', 'I']),
    M(6, ['I', 'V/iii', 'iii', 'vi']),
    M(6, ['IV', 'iv', 'I', 'V']),
    M(6, ['I', 'V7', '♭VII', 'IV']),

    // ---------- МИНОР ----------
    // Уровень 1
    m(1, ['i', 'iv']), m(1, ['i', 'V']), m(1, ['iv', 'i']), m(1, ['V', 'i']),
    m(1, ['i', 'iv', 'i'], 'Плагальный оборот'), m(1, ['i', 'V', 'i'], 'Автентический оборот'),
    m(1, ['iv', 'V', 'i']), m(1, ['i', 'iv', 'V']),
    // Уровень 2
    m(2, ['i', 'iv', 'V', 'i'], 'Полная каденция'),
    m(2, ['i', 'V', 'iv', 'i']),
    m(2, ['i', 'iv', 'i', 'V']),
    m(2, ['i', 'iv', 'V', 'V'], '', ['Billie Eilish — bad guy']),
    m(2, ['i', 'V', 'i', 'iv']),
    m(2, ['iv', 'i', 'V', 'i']),
    m(2, ['i', 'iv', 'V', 'iv']),
    m(2, ['i', 'i', 'iv', 'i', 'V', 'iv', 'i', 'V'], 'Минорный блюз (сжатый)'),
    // Уровень 3
    m(3, ['i', 'VI', 'III', 'VII'], 'Минорный поп-оборот', ['The Cranberries — Zombie', 'Linkin Park — Numb', 'Toto — Africa (припев)']),
    m(3, ['i', 'VII', 'VI', 'V'], 'Андалузская каденция', ['Ray Charles — Hit the Road Jack', 'Dire Straits — Sultans of Swing', 'Del Shannon — Runaway']),
    m(3, ['i', 'iv', 'III', 'VI'], '', ['Nirvana — Smells Like Teen Spirit']),
    m(3, ['i', 'III', 'VII', 'iv']),
    m(3, ['i', 'VI', 'V', 'V'], '', ['Eurythmics — Sweet Dreams']),
    m(3, ['i', 'III', 'VII', 'i'], '', ['Dolly Parton — Jolene']),
    m(3, ['i', 'VI', 'VII', 'i'], 'Эолийский оборот'),
    m(3, ['i', 'VII', 'VI', 'VII']),
    m(3, ['i', 'iv', 'VII', 'III']),
    m(3, ['i', 'VI', 'iv', 'V']),
    m(3, ['VI', 'VII', 'i', 'i'], 'Эолийская каденция'),
    m(3, ['i', 'III', 'iv', 'V']),
    // Уровень 4
    m(4, ['i', 'III', 'IV', 'VI', 'i', 'III', 'V', 'V'], '', ['The Animals — House of the Rising Sun']),
    m(4, ['i', 'III', 'VII', 'IV'], '', ['Green Day — Boulevard of Broken Dreams', 'Gary Jules — Mad World']),
    m(4, ['i', 'v', 'VII', 'i'], '', ['Bill Withers — Ain’t No Sunshine']),
    m(4, ['i', 'VII', 'IV', 'IV'], 'Дорийский оборот', ['Chris Isaak — Wicked Game']),
    m(4, ['i', 'IV', 'i', 'IV'], 'Дорийская качалка', ['The Doors — Riders on the Storm', 'Pink Floyd — Breathe']),
    m(4, ['i', 'ii°', 'V', 'i']),
    m(4, ['i', 'iv', 'v', 'i'], 'Натуральный минор без ведущего тона'),
    m(4, ['i', 'VI', 'ii°', 'V']),
    m(4, ['i', 'v', 'VI', 'VII']),
    m(4, ['i', 'VII', 'v', 'VI']),
    m(4, ['iv', 'V', 'i', 'VI']),
    m(4, ['i', 'III', 'ii°', 'V']),
    // Уровень 5
    m(5, ['iiø7', 'V7', 'i'], 'Минорный II–V–I'),
    m(5, ['iv7', 'VII7', 'IIImaj7', 'VImaj7', 'iiø7', 'V7', 'i'], '', ['Joseph Kosma — Autumn Leaves']),
    m(5, ['i', 'V7', 'VII', 'IV', 'VI', 'III', 'iv', 'V7'], '', ['Eagles — Hotel California']),
    m(5, ['i7', 'iv7', 'V7', 'i7']),
    m(5, ['i', 'VImaj7', 'iiø7', 'V7']),
    m(5, ['i7', 'VII7', 'IIImaj7', 'VImaj7']),
    m(5, ['i', 'V:1', 'VI', 'III:1', 'iv', 'i:1', 'iiø7', 'V7'], 'Нисходящий бас'),
    m(5, ['i', 'i:1', 'iv', 'V7']),
    m(5, ['i', 'VII:1', 'VI', 'V7']),
    m(5, ['i7', 'iv7', 'VII7', 'IIImaj7']),
    m(5, ['i', 'vii°7', 'i', 'V7']),
    m(5, ['iv7', 'V7', 'i', 'i']),
    m(5, ['i', 'v7', 'VI', 'V7']),
    // Уровень 6
    m(6, ['i', 'N', 'V', 'i'], 'Неаполитанский оборот'),
    m(6, ['i', 'V/iv', 'iv', 'V', 'i'], 'Побочная доминанта к iv'),
    m(6, ['i', 'V/V', 'V', 'i'], 'Двойная доминанта'),
    m(6, ['i', 'V/VI', 'VI', 'V7', 'i']),
    m(6, ['i', 'iv', 'V', 'I'], 'Пикардийская терция'),
    m(6, ['i', 'VI', 'N', 'V']),
    m(6, ['i', 'V/III', 'III', 'VI', 'iiø7', 'V7', 'i']),
    m(6, ['i', 'V/iv', 'iv', 'N', 'V7', 'i']),
    m(6, ['iv', 'V/V', 'V', 'i']),
    m(6, ['i', 'VII', 'VI', 'V/V', 'V']),
    m(6, ['i', 'vii°7', 'i', 'N', 'V', 'I']),
  ];

  const Progressions = { DEGREE_LEVELS, PROG_LEVELS, PROGRESSIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Progressions;
  else root.Progressions = Progressions;
})(typeof window !== 'undefined' ? window : globalThis);
