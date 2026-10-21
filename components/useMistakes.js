'use client';
/* Работа над ошибками: список того, что отвечено неверно и ещё не исправлено; после верного ответа элемент выбывает. */
import { useEffect, useState, useCallback } from 'react';
import { useApp } from './AppProvider';

export function useMistakes(exercise, mode, on) {
  const { api } = useApp();
  const [items, setItems] = useState(null);
  useEffect(() => { if (!on) { setItems(null); return; } let alive = true; api('GET', `/mistakes?exercise=${exercise}&mode=${mode}`).then(d => { if (alive) setItems(d.items); }).catch(() => { if (alive) setItems([]); }); return () => { alive = false; }; }, [api, exercise, mode, on]);
  const remove = useCallback(pred => setItems(it => it ? it.filter(x => !pred(x)) : it), []);
  return { on: !!on, items, loaded: items != null, remove, count: items ? items.length : null };
}
export function MistakesEmpty({ href }) {
  return <div className="qinfo"><div className="empty-state"><div className="lead">Ошибок не осталось.</div><div className="meta">Всё, что было отвечено неверно, вы уже исправили. <a href={href}>Вернуться к обычному режиму</a>.</div></div></div>;
}

/* Красная кнопка у шестерёнки: сколько неисправленных ошибок на текущем уровне; ведёт в режим работы над ошибками */
/* сколько неисправленных ошибок на уровне (level == null — во всём ладу) */
export function useMistakeCount(exercise, mode, level) {
  const { api, tick } = useApp();
  const [items, setItems] = useState([]);
  useEffect(() => { let alive = true; api('GET', `/mistakes?exercise=${exercise}&mode=${mode}`).then(d => { if (alive) setItems(d.items); }).catch(() => {}); return () => { alive = false; }; }, [api, exercise, mode, tick]);
  return items.filter(i => level == null || i.level === level).length;
}
export function MistakesBadge({ exercise, mode, level, href, on }) {
  const n = useMistakeCount(exercise, mode, level);
  if (!n) return null;
  return <a className={'btn mistakes-btn' + (on ? ' on' : '')} href={href} data-tip={on ? 'Вы в режиме работы над ошибками' : 'Открыть работу над ошибками для этого уровня'}>Работа над ошибками <b>{n}</b></a>;
}
