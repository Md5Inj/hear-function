'use client';
/* Шапка: название, меню с подпунктами «Major / Minor», справа справка, прогресс, история, аккаунт, выход.
   Язык из next-intl; пользователь известен уже на сервере. Вёрстка на Tailwind. */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useApp } from './AppProvider';
import { cn } from '@/lib/utils';

const NAV = [['/degrees', 'degrees'], ['/intervals', 'intervals', true], ['/progressions', 'progressions'], ['/songs', 'songs'], ['/melodies', 'melodies'], ['/metronome', 'metronome', true]];
const pill = 'px-2.5 py-[7px] rounded-full text-ink-2 transition-colors hover:bg-tint hover:text-ink hover:no-underline';
const pillOn = 'bg-accent-soft text-accent font-medium hover:text-accent hover:bg-accent-soft';
const menuItem = 'flex items-center gap-2 px-3 py-[7px] rounded-lg text-ink text-[15px] hover:bg-tint hover:no-underline';
const menuItemOn = 'bg-accent-soft text-accent hover:bg-accent-soft';

function LangSwitch() {
  const locale = useLocale(); const router = useRouter();
  const set = l => { document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`; router.refresh(); };
  return (
    <span className="inline-flex items-center rounded-full border border-rule text-[12px] overflow-hidden">
      {['en', 'ru'].map(l => (
        <button key={l} onClick={() => set(l)} className={cn('px-2 py-1 uppercase', locale === l ? 'bg-accent text-white' : 'text-ink-2 hover:bg-tint')}>{l}</button>
      ))}
    </span>
  );
}

export default function Header() {
  const path = usePathname();
  const { store, openLogin, logout } = useApp();
  const t = useTranslations('Nav');
  const u = store.user;
  return (
    <header className="flex items-center justify-between gap-4 pt-[22px] pb-[18px] border-b border-rule">
      <Link className="font-serif text-xl font-medium text-ink tracking-[-0.01em] hover:no-underline" href="/">hear function</Link>
      <nav className="flex items-center gap-0.5 text-[15px]">
        {NAV.map(([href, key, plain]) => plain ? (
          <Link key={href} href={href} className={cn(pill, path === href && pillOn)}>{t(key)}</Link>
        ) : (
          <div key={href} className="relative group">
            <Link href={href} className={cn(pill, path === href && pillOn)}>{t(key)}</Link>
            <div className="absolute left-0 top-full pt-1.5 z-[60] hidden group-hover:block group-focus-within:block">
              <div className="min-w-32 p-1.5 bg-paper border border-rule rounded-xl shadow-[0_10px_28px_rgba(28,32,51,0.14)]">
                <Link href={href + '?mode=major'} prefetch={false} className="block px-3 py-[7px] rounded-lg text-ink text-[15px] hover:bg-tint hover:no-underline">{t('major')}</Link>
                <Link href={href + '?mode=minor'} prefetch={false} className="block px-3 py-[7px] rounded-lg text-ink text-[15px] hover:bg-tint hover:no-underline">{t('minor')}</Link>
              </div>
            </div>
          </div>
        ))}
        <span className="inline-flex items-center gap-2 ml-1.5 pl-2.5 border-l border-rule leading-none">
          <LangSwitch />
          <Link href="/guide" className={cn('inline-flex items-center', pill, path === '/guide' && pillOn)} data-tip={t('help')} aria-label={t('help')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
          </Link>
          {u ? (
            <div className="relative group">
              <Link href="/account" className={cn('inline-flex items-center gap-1.5 bg-tint text-ink rounded-full pl-3 pr-2.5 py-1.5 text-sm hover:no-underline', (path === '/account' || path === '/history' || path === '/progress') && 'ring-1 ring-accent')} data-tip={(u.email || '')}>
                {u.name}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-3"><path d="M6 9l6 6 6-6" /></svg>
              </Link>
              <div className="absolute right-0 top-full pt-1.5 z-[60] hidden group-hover:block group-focus-within:block">
                <div className="min-w-44 p-1.5 bg-paper border border-rule rounded-xl shadow-[0_10px_28px_rgba(28,32,51,0.14)]">
                  <Link href="/account" prefetch={false} className={cn(menuItem, path === '/account' && menuItemOn)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
                    {t('myAccount')}
                  </Link>
                  <Link href="/history" prefetch={false} className={cn(menuItem, path === '/history' && menuItemOn)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    {t('history')}
                  </Link>
                  <Link href="/progress" prefetch={false} className={cn(menuItem, path === '/progress' && menuItemOn)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16" /><path d="M4 15l5-5 4 4 7-7" /></svg>
                    {t('stats')}
                  </Link>
                  <div className="my-1 border-t border-rule" />
                  <button className="flex w-full items-center gap-2 px-3 py-[7px] rounded-lg text-ink-2 text-[15px] bg-transparent border-0 cursor-pointer text-left hover:bg-tint hover:text-bad" onClick={logout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 3v18" /></svg>
                    {t('signOut')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button className="rounded-full bg-accent text-white px-3.5 py-[7px] text-sm font-medium transition-colors hover:bg-[#2740b8]" onClick={() => openLogin()}>{t('signIn')}</button>
          )}
        </span>
      </nav>
    </header>
  );
}
