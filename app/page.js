import { Suspense } from 'react';
import Link from 'next/link';
import Songs from '@/lib/songs-db';
import P from '@/lib/progressions';
import { loadCorpus } from '@/lib/corpus';
import { currentState } from '@/lib/session';
import { LandingCta, TermTip } from '@/components/Landing';

function Stat({ name, levels, num, label, sub }) {
  return <div className="stat"><div className="stat-name">{name}</div><div className="stat-num">{num}</div><div className="stat-label">{label}</div><div className="stat-sub">{levels}<br />{sub}</div></div>;
}
function status(progress, exercise, levels) {
  return ['major', 'minor'].map(mode => { const p = progress[exercise + '.' + mode]; if (!p || !p.total) return null; return (mode === 'major' ? 'мажор' : 'минор') + ': уровень ' + p.level + ' из ' + levels[mode].length; }).filter(Boolean);
}
export default async function Home() {
  const songs = loadCorpus();
  const chords = songs.filter(s => Songs.levelFor(s)), melodies = songs.filter(s => s.melody && s.melody.degrees.length);
  const uniq = arr => new Set(arr.map(s => s.artist + ' — ' + s.title)).size;
  const byMode = (arr, m) => arr.filter(s => s.key.mode === m).length;
  const state = await currentState(); const progress = (state && state.progress) || {};
  const tiles = [
    ['/degrees', '1 2 3 4 5 6 7', 'Ступени', 'Каденция задаёт тональность, затем звучит одна нота. Шесть уровней: от тонического трезвучия до всех двенадцати звуков и удержания тоники без каденции.', status(progress, 'degrees', P.DEGREE_LEVELS)],
    ['/progressions', 'I – V – vi – IV', 'Прогрессии', 'Прогрессии из реальной музыки на пианино и других тембрах. От трёх главных трезвучий до септаккордов, обращений и побочных доминант.', status(progress, 'progressions', P.PROG_LEVELS)],
    ['/songs', '♪ Em C G D', 'Аккорды песен', 'Фрагмент настоящей записи. Такты, выделение, цикл, замедление. Тринадцать уровней: каждый добавляет новый аккорд.', status(progress, 'songs', Songs.SONG_LEVELS)],
    ['/melodies', '♪ 3 2 1 5', 'Мелодии песен', 'Вокальная фраза из записи, ступень каждой ноты. Каденция перед фразой задаёт тональность.', status(progress, 'melodies', Songs.SONG_LEVELS)],
  ];
  return (
    <>
      <section className="landing-hero one">
        <div>
          <h1>Слышать функцию, а не ноту.</h1>
          <p>Относительный слух на настоящей музыке: ступени лада, аккордовые прогрессии и фрагменты реальных записей. Тональность меняется в каждом вопросе, сложность растёт по мере верных ответов, пройденные песни не повторяются.</p>
          <p className="hero-claim">Тренажёр помогает избавиться от <TermTip />.</p>
          <Suspense fallback={<div className="landing-cta" />}><LandingCta /></Suspense>
        </div>
      </section>
      <section className="stats">
        <Stat name="Ступени" levels={P.DEGREE_LEVELS.major.length + ' уровней в каждом ладу'} num={12} label="ступеней с альтерациями" sub="каденция и одна нота, 7 тембров" />
        <Stat name="Прогрессии" levels={P.PROG_LEVELS.major.length + ' уровней в каждом ладу'} num={P.PROGRESSIONS.length} label="прогрессий на пианино" sub={'мажор ' + P.PROGRESSIONS.filter(p => p.mode === 'major').length + ', минор ' + P.PROGRESSIONS.filter(p => p.mode === 'minor').length} />
        <Stat name="Аккорды песен" levels={Songs.SONG_LEVELS.major.length + ' уровней в мажоре, ' + Songs.SONG_LEVELS.minor.length + ' в миноре'} num={chords.length} label="фрагментов записей" sub={uniq(chords) + ' песен · мажор ' + byMode(chords, 'major') + ', минор ' + byMode(chords, 'minor')} />
        <Stat name="Мелодии песен" levels="без уровней, по ладу" num={melodies.length} label="вокальных фраз" sub={uniq(melodies) + ' песен · мажор ' + byMode(melodies, 'major') + ', минор ' + byMode(melodies, 'minor')} />
      </section>
      <h2 className="section-title" id="exercises">Наши упражнения</h2>
      <section className="choices">
        {tiles.map(([href, glyph, title, text, st]) => (
          <Link key={href} className="choice" href={href}>
            <div className="glyph">{glyph}</div>
            <h2>{title}</h2>
            <p>{text}</p>
            <div className="status">{st.map((s, i) => <span key={i}>{s}<br /></span>)}</div>
          </Link>
        ))}
      </section>
      <section className="how" id="how">
        <div><h3>Контекст тональности</h3><p>Перед каждым фрагментом звучит каденция в тональности песни, поэтому вы определяете функцию, а не абсолютную высоту.</p></div>
        <div><h3>Реальные записи</h3><p>Сотни фрагментов из хитов с разметкой по тактам, выровненной по звуку. Песни, которые вы уже проходили, больше не показываются.</p></div>
        <div><h3>Постепенные уровни</h3><p>Первый уровень: тоника и доминанта. Дальше по одному аккорду: субдоминанта, vi, ii, септаккорды, побочные доминанты.</p></div>
      </section>
    </>
  );
}
