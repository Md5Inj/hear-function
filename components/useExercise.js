'use client';
/* Контроллер упражнения (бывший ET.page): прогресс по ладу, уровни, тембр, учёт ошибок, переход на следующий уровень. */
import { useEffect, useMemo, useRef } from 'react';
import { useApp } from './AppProvider';
import { toast } from './ui';

export function useExercise(cfg) {
  const app = useExerciseApp();
  const { store, save, refresh, pick, settings } = app;
  const W = settings.levelUpWindow || 20, NEED = settings.levelUpNeed || 16;
  const mode = cfg.mode;
  // лад с сервера (адрес или сохранённый): сохраняем, если отличается от сохранённого
  useEffect(() => { if (store.mode !== mode) { store.mode = mode; save(); } }, [mode, store, save]);
  const onReset = useRef(cfg.onReset); onReset.current = cfg.onReset;
  return useMemo(() => {
    const ctx = { exercise: cfg.exercise, mode };
    ctx.prog = () => { const k = cfg.exercise + '.' + mode; if (!store.progress[k]) store.progress[k] = { level: 1, history: [], confusion: {}, total: 0, correct: 0, streak: 0, best: 0 }; return store.progress[k]; };
    ctx.levels = () => cfg.levels(mode);
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
      p.total++; if (correct) { p.correct++; p.streak++; p.best = Math.max(p.best, p.streak); } else p.streak = 0;
      p.history.push(correct ? 1 : 0); if (p.history.length > W) p.history.shift();
      let levelUp = false;
      if (p.history.length >= W && p.history.reduce((a, b) => a + b, 0) >= NEED && p.level < ctx.levels().length) { p.level++; p.history = []; levelUp = true; }
      save(); refresh();
      if (levelUp) toast('Уровень ' + p.level + ': ' + ctx.levelDef().title);
      return levelUp;
    };
    ctx.setLevel = n => { const p = ctx.prog(); p.level = n; p.history = []; save(); refresh(); if (onReset.current) onReset.current(); };
    ctx.setTimbre = v => { store.timbre = v; save(); refresh(); };
    ctx.setAutoNext = v => { store.autoNext = v; save(); refresh(); };
    ctx.setSongAutoNext = v => { store.songAutoNext = v; save(); refresh(); };
    ctx.reset = async () => { delete store.progress[cfg.exercise + '.' + mode]; await app.api('DELETE', '/progress?key=' + encodeURIComponent(cfg.exercise + '.' + mode)).catch(() => {}); refresh(); if (onReset.current) onReset.current(); };
    return ctx;
  }, [cfg.exercise, mode, store, save, refresh, pick, app, W, NEED]);
}
function useExerciseApp() { const app = useApp(); if (!app) throw new Error('useExercise вне AppProvider'); return app; }
