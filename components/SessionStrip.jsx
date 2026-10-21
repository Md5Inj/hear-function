'use client';
/* Полоса серии (сколько сделано / текущий / осталось, верно и ошибок) и попап настроек за шестерёнкой. */
import { useEffect, useRef, useState } from 'react';
import Synth from '@/lib/synth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './AppProvider';
import LevelPath from './LevelPath';

export function useSession(n) {
  const [results, setResults] = useState([]);
  const ref = useRef([]); ref.current = results;
  return {
    n, results,
    push(ok) { const r = ref.current.concat([ok]); ref.current = r; setResults(r); if (r.length >= n) { const right = r.filter(Boolean).length; import('./ui').then(m => m.toast(`Серия завершена: верно ${right} из ${n}`)); } },
    nextIfDone() { if (ref.current.length >= n) { ref.current = []; setResults([]); } },
  };
}

/* idle: вопроса нет (уровень пуст или пройден) — остаются только настройки */
export function SessionStrip({ session, noun, active, right, note, idle }) {
  // note: подпись справа от счётчика (например, «работа над ошибками»)
  const { n, results } = session;
  const good = results.filter(Boolean).length, bad = results.length - good;
  return (
    <section className="session">
      {!idle && <div className="session-steps">
        {Array.from({ length: n }, (_, i) => <i key={i} className={i < results.length ? (results[i] ? 'y' : 'n') : (i === results.length && active ? 'cur' : '')} />)}
      </div>}
      <div className="session-text">
        {active ? <>{noun} <b>{Math.min(results.length + 1, n)}</b> из {n} <span className="cnt ok" data-tip="Верно">{good}</span><span className="cnt bad" data-tip="Ошибок">{bad}</span>{note ? <span className="muted"> · {note}</span> : null}</> : null}
      </div>
      <div className="session-settings">{right}</div>
    </section>
  );
}

/* Шестерёнка и попап: уровни (всегда), тембр и автопереход (ступени и прогрессии). */
export function SettingsPopover({ ctx, showTimbre, hidden, mistakes }) {
  const { store, settings } = useApp(); const path = usePathname();
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = ev => { if (popRef.current && !popRef.current.contains(ev.target)) setOpen(false); };
    const onKey = ev => { if (ev.key === 'Escape') setOpen(false); };
    const t = setTimeout(() => { document.addEventListener('click', onClick); document.addEventListener('keydown', onKey); }, 0);
    return () => { clearTimeout(t); document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (hidden) return null;
  const p = ctx.prog();
  return (
    <>
      <button className="gear" aria-label="Настройки" data-tip="Настройки" onClick={ev => { ev.stopPropagation(); setOpen(o => !o); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
      </button>
      {open && (
        <div className="popover" ref={popRef}>
          <button className="modal-close" type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>×</button>
          <div className="pop-row"><span className="pop-label">Уровень</span>
            <LevelPath levels={ctx.levels()} level={p.level} maxLevel={p.maxLevel} history={(p.byLevel || {})[Math.max(p.maxLevel || 1, p.level)] || p.history || []} W={settings.levelUpWindow || 20} NEED={settings.levelUpNeed || 16} onSelect={n => { ctx.setLevel(n); setOpen(false); }} />
          </div>
          {mistakes && (
            <div className="pop-row"><span className="pop-label">Режим</span>
              <div className="levels-list">
                <Link className={'lvl-row' + (!mistakes.on ? ' active' : '')} href={path + '?mode=' + ctx.mode} onClick={() => setOpen(false)}><span className="num">•</span><span><b>Обычный</b><small>вопросы по уровню</small></span></Link>
                <Link className={'lvl-row' + (mistakes.on ? ' active' : '')} href={path + '?mode=' + ctx.mode + '&mistakes=1'} onClick={() => setOpen(false)}><span className="num">!</span><span><b>Работа над ошибками</b><small>{mistakes.count == null ? 'то, что отвечено неверно' : mistakes.count ? `неисправленных: ${mistakes.count}` : 'ошибок нет'}</small></span></Link>
                {mistakes.tonus != null && <Link className={'lvl-row' + (mistakes.tonus ? ' active' : '')} href={path + '?mode=' + ctx.mode + '&tonus=1'} onClick={() => setOpen(false)}><span className="num">∞</span><span><b>Тонус</b><small>{(p.maxLevel || p.level) > 1 ? `вперемешку с пройденных уровней 1–${p.maxLevel || p.level}, на уровни не влияет` : 'откроется, когда будет пройден первый уровень'}</small></span></Link>}
              </div>
            </div>
          )}
          {showTimbre && (
            <>
              <div className="pop-row"><span className="pop-label">Тембр</span>
                <select value={store.timbre} onChange={e => ctx.setTimbre(e.target.value)}>
                  <option value="auto">по уровню</option>
                  {Object.entries(Synth.PRESETS).map(([id, pr]) => <option key={id} value={id}>{pr.name}</option>)}
                </select>
              </div>
              <div className="pop-row"><label className="check"><input type="checkbox" checked={store.autoNext} onChange={e => ctx.setAutoNext(e.target.checked)} /> Переходить дальше автоматически</label></div>
            </>
          )}
        </div>
      )}
    </>
  );
}
