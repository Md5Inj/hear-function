'use client';
/* Открыт следующий уровень: пользователь сам решает — остаться на этом или перейти. */
import { Button } from './ui/button';
export default function LevelUpBanner({ ctx, onClose }) {
  const p = ctx.prog(); const next = p.maxLevel; const l = ctx.levels()[next - 1];
  if (!l || next <= p.level) return null;
  return (
    <div className="grid gap-3 mt-2.5 mb-1 px-4 py-3.5 border border-accent rounded-2xl bg-accent-soft">
      <div className="text-[15px] text-ink"><b>Level {next} unlocked: {l.title}.</b> {l.desc ? l.desc + '. ' : ''}Stay here or move on.</div>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" size="primary" onClick={() => { ctx.setLevel(next); onClose(); }}>Go to level {next}</Button>
        <Button variant="quiet" onClick={onClose}>Again on this level</Button>
      </div>
    </div>
  );
}
