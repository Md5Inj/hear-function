'use client';
/* Открыт следующий уровень: пользователь сам решает — остаться на этом или перейти. */
import { Button } from './ui/button';
import { useTranslations } from 'next-intl';
export default function LevelUpBanner({ ctx, onClose }) {
  const t = useTranslations('Level');
  const p = ctx.prog(); const next = p.maxLevel; const l = ctx.levels()[next - 1];
  if (!l || next <= p.level) return null;
  return (
    <div className="grid gap-3 mt-2.5 mb-1 px-4 py-3.5 border border-accent rounded-2xl bg-accent-soft">
      <div className="text-[15px] text-ink"><b>{t('bannerTitle', { n: next, title: l.title })}</b> {l.desc ? l.desc + '. ' : ''}{t('bannerStay')}</div>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" size="primary" onClick={() => { ctx.setLevel(next); onClose(); }}>{t('bannerGo', { n: next })}</Button>
        <Button variant="quiet" onClick={onClose}>{t('bannerAgain')}</Button>
      </div>
    </div>
  );
}
