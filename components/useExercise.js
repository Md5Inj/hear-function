'use client';
/* Контроллер упражнения (бывший ET.page): прогресс по ладу, уровни, тембр, учёт ошибок, переход на следующий уровень. */
import { useEffect, useMemo, useRef } from 'react';
import { useApp } from './AppProvider';
import { toast } from './ui';
import { useLocale, useTranslations } from 'next-intl';
import { locLevels } from '@/lib/i18n-data';

export function useExercise(cfg) {
  const app = useExerciseApp();
  const { store, save, refresh, pick, settings } = app;
  const W = settings.levelUpWindow || 20, NEED = settings.levelUpNeed || 16;
  const mode = cfg.mode;
  const locale = useLocale(); const tl = useTranslations('Level');
  // лад с сервера (адрес или сохранённый): сохраняем, если отличается от сохранённого
  useEffect(() => { if (store.mode !== mode) { store.mode = mode; save(); } }, [mode, store, save]);
  const onReset = useRef(cfg.onReset); onReset.current = cfg.onReset;
  return useMemo(() => {
    const ctx = { exercise: cfg.exercise, mode };
    // история ответов хранится по уровням (byLevel), чтобы переключение уровня не обнуляло путь к следующему; p.history — зеркало текущего уровня
    ctx.prog = () => {
      const k = cfg.exercise + '.' + mode;
      if (!store.progress[k]) store.progress[k] = { level: 1, history: [], confusion: {}, total: 0, correct: 0, streak: 0, best: 0 };
      const p = store.progress[k];
      if (!p.byLevel) p.byLevel = {};
      if (!p.confusion) p.confusion = {};
      if (!p.maxLevel || p.maxLevel < p.level) p.maxLevel = p.level;  // достигнутый уровень: не падает при переключении назад
      if (!p.byLevel[p.level]) p.byLevel[p.level] = Array.isArray(p.history) ? p.history.slice() : [];
      p.history = p.byLevel[p.level];
      return p;
    };
    ctx.levels = () => locLevels(cfg.levels(mode), locale);
    ctx.levelDef = () => ctx.levels()[ctx.prog().level - 1];
    ctx.timbre = lvl => store.timbre === 'auto' ? pick(lvl.timbres) : store.timbre;
    ctx.errRate = label => { const c = ctx.prog().confusion[label]; return !c || c.n < 2 ? 0 : c.wrong / c.n; };
    ctx.recordConfusion = (label, given) => {
      const c = ctx.prog().confusion;
      if (!c[label]) c[label] = { n: 0, wrong: 0, given: {} };
      c[label].n++;
      if (label !== given) { c[label].wrong++; c[label].given[given] = (c[label].given[given] || 0) + 1; }
    };
    ctx.recordResult = correct => {
      const p = ctx.prog();
      p.total++; if (correct) { p.correct++; p.streak++; p.best = Math.max(p.best, p.streak); p.correctByLevel = p.correctByLevel || {}; p.correctByLevel[p.level] = (p.correctByLevel[p.level] || 0) + 1; } else p.streak = 0;
      p.history.push(correct ? 1 : 0); if (p.history.length > W) p.history.shift();
      let levelUp = false;
      // правило выполнено на достигнутом уровне: открываем следующий, но пользователя не переключаем — он выберет сам
      if (p.level >= (p.maxLevel || 1) && p.level < ctx.levels().length && p.history.length >= W && p.history.reduce((a, b) => a + b, 0) >= NEED) { p.maxLevel = p.level + 1; p.byLevel[p.maxLevel] = p.byLevel[p.maxLevel] || []; levelUp = true; }
      save(); refresh();
      if (levelUp) toast(tl('unlockedToast', { n: p.maxLevel, title: ctx.levels()[p.maxLevel - 1].title }));
      return levelUp;
    };
    ctx.setLevel = n => { const p = ctx.prog(); p.level = n; p.byLevel[n] = p.byLevel[n] || []; p.history = p.byLevel[n]; save(); refresh(); if (onReset.current) onReset.current(); };
    ctx.setTimbre = v => { store.timbre = v; save(); refresh(); };
    ctx.setAutoNext = v => { store.autoNext = v; save(); refresh(); };
    ctx.setSongAutoNext = v => { store.songAutoNext = v; save(); refresh(); };
    ctx.reset = async () => { delete store.progress[cfg.exercise + '.' + mode]; await app.api('DELETE', '/progress?key=' + encodeURIComponent(cfg.exercise + '.' + mode)).catch(() => {}); refresh(); if (onReset.current) onReset.current(); };
    return ctx;
  }, [cfg.exercise, mode, locale, tl, store, save, refresh, pick, app, W, NEED]);
}
function useExerciseApp() { const app = useApp(); if (!app) throw new Error('useExercise outside AppProvider'); return app; }
