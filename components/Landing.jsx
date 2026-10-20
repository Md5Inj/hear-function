'use client';
/* Клиентские части лендинга: кнопки действия (вход по ?login=1), попап про тембровую слепоту. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from './AppProvider';

export function LandingCta() {
  const { store, openLogin } = useApp();
  const params = useSearchParams(); const router = useRouter();
  const wantLogin = params.get('login'), next = params.get('next');
  useEffect(() => {
    if (!wantLogin) return;
    if (store.user) { if (next) router.replace(next); else router.replace('/'); return; }
    openLogin(next);
  }, [wantLogin, next, store.user, openLogin, router]);
  if (store.user) return <div className="landing-cta"><Link href="/songs" className="btn primary">Продолжить</Link><Link href="/history" className="btn quiet">История</Link></div>;
  return <div className="landing-cta"><button className="btn primary" onClick={() => openLogin()}>Начать</button><a href="#how" className="btn quiet">Как это работает</a></div>;
}

export function TermTip() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onClick = ev => { if (!ev.target.closest('.term-tip')) setOpen(false); };
    const onKey = ev => { if (ev.key === 'Escape') setOpen(false); };
    const t = setTimeout(() => { document.addEventListener('click', onClick); document.addEventListener('keydown', onKey); }, 0);
    return () => { clearTimeout(t); document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <>
      <button className="term" onClick={ev => { ev.stopPropagation(); setOpen(o => !o); }}>тембровой слепоты</button>
      {open && (
        <span className="term-tip">
          <button className="modal-close" type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>×</button>
          <b>Тембровая слепота</b> — когда ступень или аккорд узнаются только в привычном звучании: на пианино функция слышна, а в гитаре, струнных или голосе на фоне плотной аранжировки теряется. Слух привязан к тембру и регистру, а не к функции звука в тональности.<br /><br />Здесь тембр меняется от вопроса к вопросу: семь инструментов в ступенях и прогрессиях, а в песнях настоящие записи с разной фактурой. Тональность тоже каждый раз другая, поэтому узнавание отвязывается от окраски звука.
        </span>
      )}
    </>
  );
}
