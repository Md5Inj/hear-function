import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { tr } from '@/lib/i18n-data';
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
  const t = await getTranslations('Home');
  const locale = await getLocale();
  const nav = await getTranslations('Nav');
  const store = getStore();
  const chords = (await chordSongs(store)).filter(s => Songs.levelFor(s)), melodies = await melodySongs(store);
  const uniq = arr => new Set(arr.map(s => s.artist + ' — ' + s.title)).size;
  const byMode = (arr, m) => arr.filter(s => s.key.mode === m).length;
  const state = await currentState(); const progress = (state && state.progress) || {}; const st = await appSettings();
  const tiles = [
    ['/degrees', '1 2 3 4 5 6 7', nav('degrees'), t('tileDegreesText'), status(progress, 'degrees', P.DEGREE_LEVELS, st)],
    ['/intervals', 'P5  M3  m7', nav('intervals'), t('tileIntervalsText'), status(progress, 'intervals', { major: IV.LEVELS, minor: IV.LEVELS }, st)],
    ['/progressions', 'I – V – vi – IV', nav('progressions'), t('tileProgText'), status(progress, 'progressions', P.PROG_LEVELS, st)],
    ['/songs', '♪ Em C G D', nav('songs'), t('tileSongsText'), status(progress, 'songs', Songs.SONG_LEVELS, st)],
    ['/melodies', '♪ 3 2 1 5', nav('melodies'), t('tileMelText'), status(progress, 'melodies', Songs.SONG_LEVELS, st)],
  ];
  return (
    <>
      <section className="landing-hero one">
        <div>
          <h1>{t('heroTitle')}</h1>
          <p>{t('heroText')}</p>
          <p className="hero-claim">{t.rich('heroClaim', { term: () => <TermTip /> })}</p>
          <Suspense fallback={<div className="landing-cta" />}><LandingCta /></Suspense>
        </div>
      </section>
      <section className="stats">
        <Stat name={nav('degrees')} levels={t('statDegreesLevels', { n: P.DEGREE_GROUPS.major.length })} num={12} label={t('statDegreesLabel')} sub={t('statDegreesSub')} />
        <Stat name={nav('progressions')} levels={t('statProgLevels', { n: P.PROG_LEVELS.major.length })} num={P.PROGRESSIONS.length} label={t('statProgLabel')} sub={t('statProgSub', { a: P.PROGRESSIONS.filter(p => p.mode === 'major').length, b: P.PROGRESSIONS.filter(p => p.mode === 'minor').length })} />
        <Stat name={nav('songs')} levels={t('statSongsLevels', { a: Songs.SONG_LEVELS.major.length, b: Songs.SONG_LEVELS.minor.length })} num={chords.length} label={t('statSongsLabel')} sub={t('statSongsSub', { u: uniq(chords), a: byMode(chords, 'major'), b: byMode(chords, 'minor') })} />
        <Stat name={nav('melodies')} levels={t('statMelLevels')} num={melodies.length} label={t('statMelLabel')} sub={t('statMelSub', { u: uniq(melodies), a: byMode(melodies, 'major'), b: byMode(melodies, 'minor') })} />
      </section>
      <h2 className="section-title" id="exercises">{t('exercises')}</h2>
      <section className="choices">
        {tiles.map(([href, glyph, title, text, stt]) => (
          <Link key={href} className="choice" href={href}>
            <div className="glyph">{glyph}</div>
            <h2>{title}</h2>
            <p>{text}</p>
            <div className="status">{stt.map(x => {
              const right = Math.min(x.history.reduce((a, b) => a + b, 0), x.NEED), n = x.levels.length;
              const pct = Math.min(100, Math.round(((x.level - 1) + (x.level >= n && right >= x.NEED ? 1 : right / x.NEED)) / n * 100));
              const r = 13, c = 2 * Math.PI * r;
              return (
                <div key={x.mode} className="tile-progress">
                  <svg className="tile-ring" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r={r} fill="none" stroke="var(--rule)" strokeWidth="3" /><circle cx="16" cy="16" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 16 16)" /></svg>
                  <div className="tile-progress-text">
                    <div><b>{pct}%</b>{href !== '/intervals' && <span className="tile-mode">{x.mode === 'major' ? t('statusMajor') : t('statusMinor')}</span>}</div>
                    <small>{tr(x.levels[x.level - 1].title, locale)}</small>
                  </div>
                </div>
              );
            })}</div>
          </Link>
        ))}
      </section>
      <h2 className="section-title">{t('whyTitle')}</h2>
      <section className="why">
        <div><h3>{t('why1h')}</h3><p>{t('why1p')}</p></div>
        <div><h3>{t('why2h')}</h3><p>{t('why2p')}</p></div>
        <div><h3>{t('why3h')}</h3><p>{t('why3p')}</p></div>
      </section>
      <h2 className="section-title">{t('diffTitle')}</h2>
      <section className="diff">
        <div className="diff-row head"><span /><span>{t('diffH1')}</span><span>{t('diffH2')}</span></div>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="diff-row"><span>{t(`diffR${i}k`)}</span><span>{t(`diffR${i}a`)}</span><span>{t(`diffR${i}b`)}</span></div>
        ))}
      </section>
      <h2 className="section-title">{t('howTitle')}</h2>
      <section className="how" id="how">
        <div><h3>{t('how1h')}</h3><p>{t('how1p')}</p></div>
        <div><h3>{t('how2h')}</h3><p>{t('how2p')}</p></div>
        <div><h3>{t('how3h')}</h3><p>{t('how3p')}</p></div>
      </section>
      <h2 className="section-title">{t('insideTitle')}</h2>
      <section className="how" id="how2">
        <div><h3>{t('in1h')}</h3><p>{t('in1p')}</p></div>
        <div><h3>{t('in2h')}</h3><p>{t('in2p')}</p></div>
        <div><h3>{t('in3h')}</h3><p>{t('in3p')}</p></div>
      </section>
    </>
  );
}
