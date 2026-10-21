import { Suspense } from 'react';
import Link from 'next/link';
import Songs from '@/lib/songs-db';
import P from '@/lib/progressions';
import IV from '@/lib/intervals';
import { chordSongs, melodySongs } from '@/lib/corpus';
import { getStore } from '@/lib/db';
import { currentState } from '@/lib/session';
import { LandingCta, TermTip } from '@/components/Landing';
import { appSettings } from '@/lib/api';

function Stat({ name, levels, num, label, sub }) {
  return <div className="stat"><div className="stat-name">{name}</div><div className="stat-num">{num}</div><div className="stat-label">{label}</div><div className="stat-sub">{levels}<br />{sub}</div></div>;
}
function status(progress, exercise, levels, st) {
  return ['major', 'minor'].map(mode => { const p = progress[exercise + '.' + mode]; if (!p || !p.total) return null; const top = Math.max(p.maxLevel || 1, p.level); return { mode, levels: levels[mode], level: top, maxLevel: top, history: (p.byLevel || {})[top] || p.history || [], W: st.levelUpWindow, NEED: st.levelUpNeed }; }).filter(Boolean);
}
export default async function Home() {
  const store = getStore();
  const chords = (await chordSongs(store)).filter(s => Songs.levelFor(s)), melodies = await melodySongs(store);
  const uniq = arr => new Set(arr.map(s => s.artist + ' — ' + s.title)).size;
  const byMode = (arr, m) => arr.filter(s => s.key.mode === m).length;
  const state = await currentState(); const progress = (state && state.progress) || {}; const st = await appSettings();
  const tiles = [
    ['/degrees', '1 2 3 4 5 6 7', 'Ступени', 'Каденция задаёт тональность, затем звучит одна нота. Шесть групп ступеней, от тонического трезвучия до всех двенадцати звуков, в каждой четыре задачи: одна октава, разные октавы, в темпе, и то и другое.', status(progress, 'degrees', P.DEGREE_LEVELS, st)],
    ['/intervals', 'ч5  б3  м7', 'Интервалы', 'Две ноты вверх, вниз или вместе. Группы интервалов по возрастанию, каждая четырьмя задачами: вверх, вниз, гармонически и смешанно. От секунд до септим и октавы, в конце все вместе.', status(progress, 'intervals', { major: IV.LEVELS, minor: IV.LEVELS }, st)],
    ['/progressions', 'I – V – vi – IV', 'Прогрессии', 'Прогрессии из реальной музыки на пианино и других тембрах. От трёх главных трезвучий до септаккордов, обращений и побочных доминант.', status(progress, 'progressions', P.PROG_LEVELS, st)],
    ['/songs', '♪ Em C G D', 'Аккорды песен', 'Фрагмент настоящей записи. Такты, выделение, цикл, замедление. Тринадцать уровней: каждый добавляет новый аккорд.', status(progress, 'songs', Songs.SONG_LEVELS, st)],
    ['/melodies', '♪ 3 2 1 5', 'Мелодии песен', 'Вокальная фраза из записи, ступень каждой ноты. Каденция перед фразой задаёт тональность.', status(progress, 'melodies', Songs.SONG_LEVELS, st)],
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
        <Stat name="Ступени" levels={P.DEGREE_GROUPS.major.length + ' групп по 4 задачи в каждом ладу'} num={12} label="ступеней с альтерациями" sub="каденция и одна нота, 7 тембров" />
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
            <div className="status">{st.map(x => {
              // процент прохождения лестницы: пройденные уровни плюс доля текущего (верных из нужных)
              const right = Math.min(x.history.reduce((a, b) => a + b, 0), x.NEED), n = x.levels.length;
              const pct = Math.min(100, Math.round(((x.level - 1) + (x.level >= n && right >= x.NEED ? 1 : right / x.NEED)) / n * 100));
              const r = 13, c = 2 * Math.PI * r;
              return (
                <div key={x.mode} className="tile-progress">
                  <svg className="tile-ring" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r={r} fill="none" stroke="var(--rule)" strokeWidth="3" /><circle cx="16" cy="16" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 16 16)" /></svg>
                  <div className="tile-progress-text">
                    <div><b>{pct}%</b>{href !== '/intervals' && <span className="tile-mode">{x.mode === 'major' ? 'мажор' : 'минор'}</span>}</div>
                    <small>{x.levels[x.level - 1].title}</small>
                  </div>
                </div>
              );
            })}</div>
          </Link>
        ))}
      </section>
      <h2 className="section-title">Зачем это</h2>
      <section className="why">
        <div>
          <h3>Слух, который работает в живой музыке</h3>
          <p>Музыкант узнаёт аккорд не по абсолютной высоте, а по его роли в тональности: тоника, доминанта, субдоминанта. Это и есть функциональный слух. Он позволяет подобрать песню на слух, сыграть по цифровке, услышать, куда движется гармония, и импровизировать, не считая интервалы.</p>
        </div>
        <div>
          <h3>Почему обычные тренажёры не дают этого</h3>
          <p>Интервалы и аккорды на синтезаторе в изоляции учат узнавать звучание, а не функцию. В настоящей записи, где гитара, бас, голос и барабаны звучат одновременно, навык с «чистого» пианино часто не переносится: это и есть тембровая слепота. Здесь упражнения построены так, чтобы слух привязывался к функции, а не к окраске звука.</p>
        </div>
        <div>
          <h3>Контекст прежде всего</h3>
          <p>Перед каждым вопросом звучит каденция в тональности примера. Вы всегда знаете, где тоника, и определяете услышанное относительно неё, как это делает музыкант в ансамбле. Тональность меняется от вопроса к вопросу, поэтому запомнить абсолютную высоту не получится, работает только относительный слух.</p>
        </div>
      </section>
      <h2 className="section-title">Чем отличается от других тренажёров</h2>
      <section className="diff">
        <div className="diff-row head"><span /><span>Обычный тренажёр</span><span>Здесь</span></div>
        <div className="diff-row"><span>Материал</span><span>синтезированные интервалы и аккорды</span><span>фрагменты настоящих записей с разметкой по тактам, выровненной по звуку и проверенной на слух</span></div>
        <div className="diff-row"><span>Что определяете</span><span>интервал или тип аккорда</span><span>ступень и функцию аккорда в тональности, в том числе внутри реальной аранжировки</span></div>
        <div className="diff-row"><span>Контекст</span><span>звук в пустоте</span><span>каденция перед каждым вопросом, тональность каждый раз другая</span></div>
        <div className="diff-row"><span>Сложность</span><span>настраивается вручную</span><span>лестница уровней: новый аккорд открывается, когда предыдущие уже слышны уверенно</span></div>
        <div className="diff-row"><span>Повторы</span><span>случайный набор</span><span>пройденные песни не повторяются, ошибки копятся в отдельный режим и отрабатываются до верного ответа</span></div>
        <div className="diff-row"><span>Тембр</span><span>один инструмент</span><span>семь тембров в ступенях и прогрессиях, живые записи с разной фактурой в песнях</span></div>
      </section>
      <h2 className="section-title">Как заниматься</h2>
      <section className="how" id="how">
        <div><h3>По десять вопросов</h3><p>Упражнение идёт сериями по десять вопросов, это пять минут. Лучше две серии каждый день, чем час раз в неделю: слух растёт от регулярности.</p></div>
        <div><h3>Снизу вверх</h3><p>Начинайте со ступеней на первом уровне, затем прогрессии, затем аккорды песен. Переход на следующий уровень открывается сам, когда из двадцати последних ответов шестнадцать верных.</p></div>
        <div><h3>Ошибки важнее успехов</h3><p>Что вы спутали, сохраняется. Режим «Работа над ошибками» задаёт только это, пока вы не ответите верно. Загляните в него после каждой серии.</p></div>
      </section>
      <h2 className="section-title">Что внутри</h2>
      <section className="how" id="how2">
        <div><h3>Контекст тональности</h3><p>Перед каждым фрагментом звучит каденция в тональности песни, поэтому вы определяете функцию, а не абсолютную высоту.</p></div>
        <div><h3>Реальные записи</h3><p>Сотни фрагментов из хитов с разметкой по тактам, выровненной по звуку. Песни, которые вы уже проходили, больше не показываются.</p></div>
        <div><h3>Постепенные уровни</h3><p>Первый уровень: тоника и доминанта. Дальше по одному аккорду: субдоминанта, vi, ii, септаккорды, побочные доминанты.</p></div>
      </section>
    </>
  );
}
