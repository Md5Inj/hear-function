'use client';
/* Шапка: название, меню с подпунктами «Мажор / Минор», справа история, имя (аккаунт) и выход или кнопка «Войти».
   Пользователь известен уже на сервере, поэтому шапка не прыгает после загрузки. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './AppProvider';

const NAV = [['/degrees', 'Ступени'], ['/intervals', 'Интервалы', true], ['/progressions', 'Прогрессии'], ['/songs', 'Аккорды песен'], ['/melodies', 'Мелодии песен']];

export default function Header() {
  const path = usePathname();
  const { store, openLogin, logout } = useApp();
  const u = store.user;
  return (
    <header className="top">
      <Link className="brand" href="/">Тренажёр слуха</Link>
      <nav className="nav">
        {NAV.map(([href, label, plain]) => plain ? <Link key={href} href={href} className={'nav-plain' + (path === href ? ' current' : '')}>{label}</Link> : (
          <div key={href} className={'nav-item' + (path === href ? ' current' : '')}>
            <Link href={href} className={path === href ? 'current' : ''}>{label}</Link>
            <div className="nav-sub"><div className="nav-sub-box"><Link href={href + '?mode=major'} prefetch={false}>Мажор</Link><Link href={href + '?mode=minor'} prefetch={false}>Минор</Link></div></div>
          </div>
        ))}
        <Link href="/guide" className={'nav-guide' + (path === '/guide' ? ' current' : '')} data-tip="Как пользоваться">Справка</Link>
        <span className="user-chip">
          {u ? (
            <>
              <Link href="/progress" className={'hist-link' + (path === '/progress' ? ' current' : '')} data-tip="Прогресс" aria-label="Прогресс">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16" /><path d="M4 15l5-5 4 4 7-7" /></svg>
              </Link>
              <Link href="/history" className={'hist-link' + (path === '/history' ? ' current' : '')} data-tip="История" aria-label="История">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </Link>
              <Link href="/account" className={'user-pill' + (path === '/account' ? ' current' : '')} data-tip={'Аккаунт: ' + (u.email || '')}>{u.name}</Link>
              <button className="link logout" data-tip="Выйти" aria-label="Выйти" onClick={logout}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 3v18" /></svg>
              </button>
            </>
          ) : (
            <button className="btn primary mini" onClick={() => openLogin()}>Войти</button>
          )}
        </span>
      </nav>
    </header>
  );
}
