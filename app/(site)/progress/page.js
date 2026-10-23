import { requireUser } from '@/lib/page-mode';
import { currentState } from '@/lib/session';
import { appSettings } from '@/lib/api';
import { getStore } from '@/lib/db';
import P from '@/lib/progressions';
import Songs from '@/lib/songs-db';
import IV from '@/lib/intervals';
import LevelPath from '@/components/LevelPath';
import { getTranslations, getLocale } from 'next-intl/server';
import { locLevels } from '@/lib/i18n-data';
export async function generateMetadata() { const t = await getTranslations('Progress'); return { title: t('metaTitle') }; }
const EX = [['degrees', P.DEGREE_LEVELS], ['intervals', { major: IV.LEVELS }], ['progressions', P.PROG_LEVELS], ['songs', Songs.SONG_LEVELS]];
const fmt = (iso, locale) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
export default async function Progress() {
  const user = await requireUser('/progress');
  const t = await getTranslations('Progress'); const locale = await getLocale();
  const state = await currentState(); const progress = (state && state.progress) || {}; const st = await appSettings();
  const answers = await getStore().find('answers', { userId: user.id });
  const lastAt = {}; for (const a of answers) { const k = a.exercise + '.' + a.mode; if (!lastAt[k] || a.at > lastAt[k]) lastAt[k] = a.at; }
  return (
    <section className="pt-7">
      <h1 className="font-serif font-medium text-[30px] mb-1.5">{t('title')}</h1>
      <p className="text-ink-2 text-sm">{t('intro', { need: st.levelUpNeed, w: st.levelUpWindow })}</p>
      {EX.map(([ex, levels]) => (
        <div key={ex} className="mt-7">
          <h2 className="font-serif font-medium text-[22px] mb-1">{t(ex)}</h2>
          {(levels.minor ? ['major', 'minor'] : ['major']).map(mode => { const p = progress[ex + '.' + mode] || { level: 1, history: [], total: 0 }; const top = Math.max(p.maxLevel || 1, p.level); const cbl = p.correctByLevel || {}; const pct = Math.round((levels[mode].filter((_, i) => (cbl[i + 1] || 0) >= 100).length / levels[mode].length) * 100); return (
            <div key={mode} className="pt-2 pb-3.5 border-t border-rule">
              <div className="flex justify-between gap-3 flex-wrap text-[15px]"><span>{levels.minor ? t(mode) : t('allTasks')}</span><span className="muted">{t('done', { pct })}{p.total ? t('answers', { n: p.total, c: p.correct }) : t('notStarted')}{lastAt[ex + '.' + mode] ? t('last', { d: fmt(lastAt[ex + '.' + mode], locale) }) : ''}</span></div>
              <LevelPath levels={locLevels(levels[mode], locale)} level={top} maxLevel={top} passed={cbl} history={(p.byLevel || {})[top] || p.history || []} W={st.levelUpWindow} NEED={st.levelUpNeed} />
            </div>
          ); })}
        </div>
      ))}
      <div className="mt-7"><h2 className="font-serif font-medium text-[22px] mb-1">{t('melTitle')}</h2><p className="text-ink-3 text-[15px]">{t('melText')}</p></div>
    </section>
  );
}
