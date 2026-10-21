'use client';
/* Открыт следующий уровень: пользователь сам решает — остаться на этом или перейти. */
export default function LevelUpBanner({ ctx, onClose }) {
  const p = ctx.prog(); const next = p.maxLevel; const l = ctx.levels()[next - 1];
  if (!l || next <= p.level) return null;
  return (
    <div className="levelup">
      <div className="levelup-text"><b>Открыт уровень {next}: {l.title}.</b> {l.desc ? l.desc + '. ' : ''}Можно остаться здесь или идти дальше.</div>
      <div className="actions">
        <button className="btn primary" onClick={() => { ctx.setLevel(next); onClose(); }}>Перейти на уровень {next}</button>
        <button className="btn quiet" onClick={onClose}>Ещё раз на этом уровне</button>
      </div>
    </div>
  );
}
