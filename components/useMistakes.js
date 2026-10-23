'use client';
/* Работа над ошибками: список того, что отвечено неверно и ещё не исправлено; после верного ответа элемент выбывает. */
import { useEffect, useState, useCallback } from 'react';
import { useApp } from './AppProvider';
import { useTranslations } from 'next-intl';

export function useMistakes(exercise, mode, on) {
  const { api } = useApp();
  const [items, setItems] = useState(null);
  useEffect(() => { if (!on) { setItems(null); return; } let alive = true; api('GET', `/mistakes?exercise=${exercise}&mode=${mode}`).then(d => { if (alive) setItems(d.items); }).catch(() => { if (alive) setItems([]); }); return () => { alive = false; }; }, [api, exercise, mode, on]);
  const remove = useCallback(pred => setItems(it => it ? it.filter(x => !pred(x)) : it), []);
  return { on: !!on, items, loaded: items != null, remove, count: items ? items.length : null };
}
export function MistakesEmpty({ href }) {
  const ts = useTranslations('Session');
  return <div className="text-ink-2 text-[15px]"><div className="text-center py-14"><div className="font-serif text-2xl">{ts('noMistakesTitle')}</div><div className="text-ink-2 mt-2">{ts('noMistakesText')} <a className="text-accent hover:underline" href={href}>{ts('backNormal')}</a>.</div></div></div>;
}

export function useMistakeCount(exercise, mode, level) {
  const { api, tick } = useApp();
  const [items, setItems] = useState([]);
  useEffect(() => { let alive = true; api('GET', `/mistakes?exercise=${exercise}&mode=${mode}`).then(d => { if (alive) setItems(d.items); }).catch(() => {}); return () => { alive = false; }; }, [api, exercise, mode, tick]);
  return items.filter(i => level == null || i.level === level).length;
}
export function MistakesBadge({ exercise, mode, level, href, on }) {
  const n = useMistakeCount(exercise, mode, level); const ts = useTranslations('Session');
  if (!n) return null;
  return <a className="inline-flex items-center gap-1.5 bg-bad border border-bad text-white rounded-full px-3.5 py-[7px] text-sm hover:no-underline" href={href} data-tip={on ? ts('badgeOn') : ts('badgeOff')}>{ts('badge')} <b>{n}</b></a>;
}
