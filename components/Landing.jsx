'use client';
/* Клиентские части лендинга: кнопки действия (вход по ?login=1), попап про тембровую слепоту. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApp } from './AppProvider';
import { Button } from './ui/button';

export function LandingCta() {
  const { store, openLogin } = useApp();
  const t = useTranslations('Home');
  const params = useSearchParams(); const router = useRouter();
  const wantLogin = params.get('login'), next = params.get('next');
  useEffect(() => {
    if (!wantLogin) return;
    if (store.user) { if (next) router.replace(next); else router.replace('/'); return; }
    openLogin(next);
  }, [wantLogin, next, store.user, openLogin, router]);
  if (store.user) return <div className="flex flex-wrap gap-3 justify-center mt-[26px]"><Button asChild variant="primary" size="primary"><Link href="/songs">{t('ctaContinue')}</Link></Button><Button asChild variant="quiet"><Link href="/progress">{t('ctaMyPath')}</Link></Button><Button asChild variant="quiet"><Link href="/history">{t('ctaHistory')}</Link></Button></div>;
  return <div className="flex flex-wrap gap-3 justify-center mt-[26px]"><Button variant="primary" size="primary" onClick={() => openLogin()}>{t('ctaStart')}</Button><Button asChild variant="quiet"><Link href="/guide">{t('ctaHowTo')}</Link></Button></div>;
}

export function TermTip() {
  const t = useTranslations('Home');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onClick = ev => { if (!ev.target.closest('.term-pop')) setOpen(false); };
    const onKey = ev => { if (ev.key === 'Escape') setOpen(false); };
    const id = setTimeout(() => { document.addEventListener('click', onClick); document.addEventListener('keydown', onKey); }, 0);
    return () => { clearTimeout(id); document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <span className="term-pop">
      <button className="term-tip-anchor underline decoration-dotted text-accent cursor-pointer bg-transparent border-0 p-0" onClick={ev => { ev.stopPropagation(); setOpen(o => !o); }}>{t('termWord')}</button>
      {open && (
        <span className="absolute left-0 top-full mt-2 z-30 w-[min(400px,calc(100vw-2.5rem))] bg-paper border border-rule rounded-xl shadow-[0_12px_32px_rgba(28,32,51,0.12)] p-4 pt-5 text-[15px] text-ink leading-normal font-normal normal-case text-left">
          <button className="absolute top-2 right-2 w-8 h-8 rounded-full bg-transparent text-ink-3 text-2xl leading-none inline-flex items-center justify-center cursor-pointer hover:bg-tint hover:text-ink" type="button" aria-label="x" onClick={() => setOpen(false)}>×</button>
          {t.rich('termBody', { b: c => <b>{c}</b>, br: () => <br /> })}
        </span>
      )}
    </span>
  );
}
