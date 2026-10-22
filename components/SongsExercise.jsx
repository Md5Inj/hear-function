'use client';
/* Страницы «Аккорды песен» и «Мелодии песен»: фрагмент реальной записи через YouTube, аккорды по тактам или ступени фразы.
   Логика перенесена из exercise-songs.js: состояние в st (ref), отрисовка — JSX, перерисовка через rerender(). */
import { useEffect, useLayoutEffect, useRef, useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import T from '@/lib/theory';
import SB from '@/lib/songs-db';
import { sectionEn } from '@/lib/sections';
import { YTP as Y } from '@/lib/yt';
import { useApp } from './AppProvider';
import { useExercise } from './useExercise';
import { useSession, SessionStrip, SettingsPopover } from './SessionStrip';
import { useMistakes, MistakesEmpty, MistakesBadge, useMistakeCount } from './useMistakes';
import HelpPopover from './HelpPopover';
import LevelPath from './LevelPath';
import LevelUpBanner from './LevelUpBanner';
import { toast } from './ui';
import { Button } from './ui/button';
import * as EX from './ui/ex';
import { useTranslations } from 'next-intl';

const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const isChrom = (sym, mode) => /\//.test(sym) || /^♭/.test(sym) || sym === 'N' || (mode === 'minor' && sym === 'I') || (mode === 'major' && sym === 'iv') || sym === 'vii°7';
/* Единицы ответа: каждый аккорд разрезан по тактовым чертам, т.е. один слот = один такт (или часть такта при смене внутри него) */
function buildUnits(song) { return SB.barUnits(song).map(u => Object.assign(u, { sym: T.parseToken(u.c).symbol, token: u.c })); }
/* после ответа курсор идёт на следующий такт по порядку; с последнего такта — на первый пустой, если он есть */
const advance = (slots, sel) => { if (sel + 1 < slots.length) return sel + 1; const any = slots.findIndex(s => !s); return any >= 0 ? any : sel; };

export default function SongsExercise({ task, mode, forcedSong, review, mistakes, tonus }) {
  const TASK = task; const isMel = TASK === 'melody';
  const R = review || null;  // режим проверки в админке: заданная песня, полный словарь, без прогресса и истории
  const app = useApp(); const { store, audio, logAnswer, weightedPick, loadSongs, settings } = app;
  const tx = useTranslations('Ex');
  const router = useRouter();
  const [, rerender] = useReducer(x => x + 1, 0);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [ipWarning, setIpWarning] = useState(false);
  const session = useSession(settings.sessionLength || 10);
  const mk = useMistakes(isMel ? 'melodies' : 'songs', mode, mistakes && !review); const mkRef = useRef(mk); mkRef.current = mk;
  const page = useExercise({ exercise: isMel ? 'melodies' : 'songs', mode, levels: m => SB.SONG_LEVELS[m], onReset: () => next() });
  const mistakeCount = useMistakeCount(isMel ? 'melodies' : 'songs', mode, isMel ? null : page.prog().level);
  const st = useRef({ q: null, answered: false, lastSong: null, autoTimer: null, played: false, cadenceTimer: null, chordSlots: [], melSlots: [], selChord: 0, selMel: 0, active: 'chords', anchor: null, loopOn: false, rate: 1, pendingAcc: null, loopRange: null, transport: false, playing: -1, melPlaying: false, unavailable: new Set(), forced: forcedSong || null, repeat: false }).current;
  const sheetRef = useRef(null), chordsRef = useRef(null), trRef = useRef(null), playerHost = useRef(null);

  const KIND = isMel ? 'melody' : 'chords';
  const allSongs = () => (store.songs[KIND] || []).map(s => { const e = SB.expand(s); e.level = SB.levelFor(e) || e.level; return e; }).filter(s => SB.levelFor(s));
  const wantChords = () => !isMel;
  const wantMelody = s => TASK !== 'chords' && s.melody && s.melody.degrees.length;
  const seenKey = s => (isMel ? 'melodies' : 'songs') + ':' + s.id;
  const fits = (s, lvl) => !st.unavailable.has(s.id) && s.key.mode === page.mode && (isMel ? (s.melody && s.melody.degrees.length) : s.level === (lvl || page.prog().level));
  /* Пул уровня: фрагменты ровно этого уровня; если их мало, добираем только более простые уровни */
  const poolAll = () => {
    if (isMel) return allSongs().filter(s => fits(s));
    const L = page.prog().level, all = allSongs();
    if (tonus) { const top = Math.max(page.prog().maxLevel || 1, L); return all.filter(s => !st.unavailable.has(s.id) && s.key.mode === page.mode && s.level <= top); }  // тонус: все пройденные уровни
    let out = all.filter(s => fits(s, L));
    for (let lvl = L - 1; lvl >= 1 && out.length < (settings.poolMin || 8); lvl--) out = out.concat(all.filter(s => fits(s, lvl)));
    return out;
  };
  // пройденные песни не показываются; повтор только по явной кнопке «Повторить пройденные»
  const pool = () => { if (mkRef.current.on) { const ids = new Set((mkRef.current.items || []).map(i => i.songId)); return allSongs().filter(s => ids.has(s.id)); } const all = poolAll(); return st.repeat ? all : all.filter(s => !store.seen.has(seenKey(s))); };
  const allDone = () => { const all = poolAll(); return all.length > 0 && all.every(s => store.seen.has(seenKey(s))); };

  function newQuestion() {
    if (R) {
      const f = SB.expand(R.song); f.level = SB.levelFor(f) || f.level;
      const lv = page.levels(); const vocab = lv[Math.min(R.level || f.level, lv.length) - 1].vocab.slice();  // словарь уровня, как на фронте
      f.chords.forEach(c => { const sym = T.parseToken(c.c).symbol; if (!vocab.includes(sym)) vocab.push(sym); });
      return { song: f, units: buildUnits(f), mode: f.key.mode, vocab, chords: wantChords(), melody: !!wantMelody(f) };
    }
    let songs = pool();
    if (st.forced) {
      const f = allSongs().find(s => s.id === st.forced);
      // песня другого лада: переходим в её лад, запрос остаётся до следующего вопроса
      if (f && f.key.mode !== page.mode) { router.replace((isMel ? '/melodies' : '/songs') + '?mode=' + f.key.mode + '&song=' + encodeURIComponent(f.id)); return null; }
      st.forced = null;
      if (f) { if (!isMel) { page.prog().level = f.level; app.save(); } songs = [f]; }
      window.history.replaceState(null, '', location.pathname);
    }
    if (!songs.length) return null;
    const song = weightedPick(songs, s => (1 + 3 * Math.max(0, ...s.chords.map(c => page.errRate(T.parseToken(c.c).symbol)))) * (s.id === st.lastSong && songs.length > 1 ? 0.2 : 1));
    st.lastSong = song.id;
    const vocab = page.levelDef().vocab.slice();
    song.chords.forEach(c => { const sym = T.parseToken(c.c).symbol; if (!vocab.includes(sym)) vocab.push(sym); });
    try { audio().warm('piano', T.voiceLead(T.CADENCE[song.key.mode], song.key.mode, song.key.tonic).flatMap(c => c.notes)); } catch (e) { /* без звука на сервере */ }
    return { song, units: buildUnits(song), mode: page.mode, vocab, chords: wantChords(), melody: !!wantMelody(song) };
  }
  const unitSpan = i => [st.q.units[i].t0, st.q.units[i].t1];
  function playCadence(full) {
    const q = st.q; const e = audio(); let t = e.ctx.currentTime + 0.05;
    const mode = q.song.key.mode, tonic = q.song.key.tonic;
    const chords = full ? T.CADENCE[mode] : [T.CADENCE[mode][0]];
    T.voiceLead(chords, mode, tonic).forEach((c, i) => { const d = i === chords.length - 1 ? 1.1 : 0.6; e.playChord('piano', c.notes, t, d); t += d; });
    return t - e.ctx.currentTime;
  }
  const playRangeOf = s => isMel && s.melody ? [s.melody.start, s.melody.end] : [s.start, s.end];
  function playFragment(opts) {
    const q = st.q; if (!q) return;
    opts = opts || {}; st.played = true; clearTimeout(st.cadenceTimer);
    const s = q.song; const [a, b] = playRangeOf(s);
    if (opts.noCadence) return Y.playRange(s.youtube, a, b);
    const cadenceEnd = performance.now() + playCadence(true) * 1000 + 300;
    Y.prepare(s.youtube, a, b).then(() => { if (st.q && st.q.song !== s) return; st.cadenceTimer = setTimeout(() => Y.resume(b), Math.max(0, cadenceEnd - performance.now())); });
  }
  function playBar(i) { clearTimeout(st.cadenceTimer); const [a, b] = unitSpan(i); Y.playRange(st.q.song.youtube, a, b); }
  function selRange() { const a = st.anchor == null ? st.selChord : Math.min(st.anchor, st.selChord), b = st.anchor == null ? st.selChord : Math.max(st.anchor, st.selChord); return [a, b]; }
  function toggleLoop() { st.loopOn = !st.loopOn; st.loopRange = st.loopOn ? selRange() : null; rerender(); if (st.loopOn) playSelection(); else Y.setLoop(false); }
  function playSelection() {
    const q = st.q; if (!q || !q.chords) return; clearTimeout(st.cadenceTimer);
    const [ra, rb] = st.loopOn && st.loopRange ? st.loopRange : selRange();
    Y.playRange(q.song.youtube, q.units[ra].t0, q.units[rb].t1, st.loopOn); Y.rate(st.rate);
  }
  function playChordsSynth(symbols) {
    clearTimeout(st.cadenceTimer); Y.pause();
    const q = st.q; const e = audio(); const s = q.song, beat = 60 / s.bpm; let t = e.ctx.currentTime + 0.05;
    const voiced = T.voiceLead(symbols.map(sym => sym || 'I'), s.key.mode, s.key.tonic);
    voiced.forEach((v, i) => { const d = q.units[i].beats * beat; e.playChord('piano', v.notes, t, d * 0.95); t += d; });
  }
  function playDegreesSynth(labels) {
    clearTimeout(st.cadenceTimer); Y.pause();
    const s = st.q.song; const e = audio(); let t = e.ctx.currentTime + 0.05;
    const base = T.tonicMidi(s.key.tonic) + 12;
    labels.forEach(l => { const d = T.degreeByLabel(s.key.mode, l); if (d) e.playNote('piano', base + d.st, t, 0.42, 0.5); t += 0.45; });
  }
  function playPhrase() { clearTimeout(st.cadenceTimer); const m = st.q.song.melody; Y.playRange(st.q.song.youtube, m.start, m.end); }
  function fillChord(sym) { const q = st.q; if (st.answered || !q.chords) return; st.chordSlots[st.selChord] = sym; st.selChord = advance(st.chordSlots, st.selChord); st.active = 'chords'; rerender(); }
  function fillMel(label) { const q = st.q; if (st.answered || !q.melody) return; st.melSlots[st.selMel] = label; st.selMel = advance(st.melSlots, st.selMel); st.active = 'melody'; rerender(); }
  const complete = () => { const q = st.q; return (!q.chords || !st.chordSlots.some(s => !s)) && (!q.melody || !st.melSlots.some(s => !s)); };
  function check() {
    const q = st.q; if (!q || st.answered || !complete()) return;
    st.answered = true; st.transport = false;
    let all = true;
    if (q.chords) q.units.forEach((u, i) => { if (u.sym !== st.chordSlots[i]) all = false; if (!R && !tonus) page.recordConfusion(u.sym, st.chordSlots[i]); });
    if (q.melody) q.song.melody.degrees.forEach((d, i) => { if (d !== st.melSlots[i]) all = false; if (!R && !tonus) page.recordConfusion('♪' + d, '♪' + st.melSlots[i]); });
    if (R) { rerender(); R.onResult({ correct: all, answer: q.chords ? st.chordSlots.slice() : st.melSlots.slice(), truth: q.chords ? q.units.map(u => u.sym) : q.song.melody.degrees.slice() }); return; }
    const levelUp = tonus ? false : page.recordResult(all); if (levelUp) setLevelUpOpen(true);
    logAnswer({ exercise: isMel ? 'melodies' : 'songs', mode: q.mode, level: page.prog().level, songId: q.song.id, title: q.song.title, artist: q.song.artist, correct: all,
      answer: q.chords ? st.chordSlots.slice() : st.melSlots.slice(), truth: q.chords ? q.units.map(u => u.sym) : q.song.melody.degrees });
    session.push(all); if (all && mkRef.current.on) mkRef.current.remove(i => i.songId === q.song.id); rerender();
    if (!levelUp && store.songAutoNext) { clearTimeout(st.autoTimer); st.autoTimer = setTimeout(next, all ? 6000 : 12000); }
  }
  function next() {
    clearTimeout(st.autoTimer); clearTimeout(st.cadenceTimer); Y.pause();
    if (R && st.q && st.answered) { R.onNext(); return; }
    session.nextIfDone();
    st.q = newQuestion(); st.answered = false; st.transport = false; st.playing = -1; st.melPlaying = false;
    const q = st.q;
    if (q) {
      st.chordSlots = q.units.map(() => null); st.melSlots = q.melody ? q.song.melody.degrees.map(() => null) : [];
      st.selChord = 0; st.selMel = 0; st.active = q.chords ? 'chords' : 'melody'; st.anchor = null; st.loopOn = false; st.loopRange = null; st.rate = 1; Y.rate(1);
      Y.cue(q.song.youtube, q.song.start);
    }
    rerender();
    if (q && st.played && Y.ready) playFragment();
  }
  function retry() {
    const q = st.q; if (!q || !st.answered) return;
    clearTimeout(st.autoTimer); st.answered = false;
    if (q.chords) { st.chordSlots = st.chordSlots.map((v, i) => v === q.units[i].sym ? v : null); st.selChord = Math.max(0, st.chordSlots.findIndex(v => !v)); }
    if (q.melody) { st.melSlots = st.melSlots.map((v, i) => v === q.song.melody.degrees[i] ? v : null); st.selMel = Math.max(0, st.melSlots.findIndex(v => !v)); }
    st.active = q.chords && st.chordSlots.some(v => !v) ? 'chords' : 'melody'; st.anchor = null;
    rerender();
  }
  const fns = useRef(null); fns.current = { next, check, playCadence, playPhrase, playSelection, toggleLoop, fillChord, fillMel, playFragment, rerender };

  /* тело страницы: нижняя панель плеера; корпус; плеер YouTube; ошибки роликов */
  useEffect(() => {
    document.body.classList.add('dock'); document.body.dataset.task = TASK;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)) setIpWarning(true);
    let alive = true;
    if (R) { setLoaded(true); fns.current.next(); } else loadSongs(KIND).then(() => { if (!alive) return; setLoaded(true); if (!mistakes) fns.current.next(); });
    // плеер живёт в своём элементе, который создаём на каждое монтирование: YouTube заменяет его iframe-ом и при destroy() не возвращает
    const holder = document.createElement('div'); holder.id = 'yt-player-' + Math.random().toString(36).slice(2, 8);
    if (playerHost.current) { playerHost.current.innerHTML = ''; playerHost.current.appendChild(holder); }
    Y.create(holder.id).then(() => { if (alive && st.q) Y.cue(st.q.song.youtube, st.q.song.start); });
    Y.on('error', code => {
      const q = st.q; if (!q) return;
      st.unavailable.add(q.song.id);
      const byIp = /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname);
      toast(byIp ? tx('ipToast') : `Video failed to load (${Y.ERRORS[code] || 'error ' + code}), picking another song`);
      // песня пропускается только в этой сессии: ошибка ролика бывает временной и зависит от браузера, в базу ничего не пишем
      clearTimeout(st.autoTimer); st.autoTimer = setTimeout(() => fns.current.next(), 800);
    });
    const tick = setInterval(() => {
      const q = st.q; if (!q) return;
      const t = Y.state() === 1 && Y.currentId === q.song.youtube ? Y.time() : -1;
      let changed = false;
      if (q.chords) { const idx = t < 0 ? -1 : q.units.findIndex(u => t >= u.t0 && t < u.t1); if (idx !== st.playing) { st.playing = idx; changed = true; } }
      if (q.melody) { const m = q.song.melody; const on = t >= m.start && t < m.end; if (on !== st.melPlaying) { st.melPlaying = on; changed = true; } }
      if (changed) rerender();
    }, 60);
    return () => { alive = false; clearInterval(tick); clearTimeout(st.autoTimer); clearTimeout(st.cadenceTimer); Y.destroy(); if (playerHost.current) playerHost.current.innerHTML = ''; document.body.classList.remove('dock'); delete document.body.dataset.task; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* режим проверки: сетка (начало, темп) правится на лету — пересобираем вопрос без пересоздания плеера */
  const gridKey = R ? `${R.song.start}|${R.song.bpm}|${R.song.id}|${R.song.chords.map(c => c.c + ':' + (c.beats || '') + ':' + (c.t || '') + ':' + (c.dur || '')).join(',')}` : '';
  const firstGrid = useRef(gridKey);
  useEffect(() => {
    if (!R || firstGrid.current === gridKey || !loaded) return;
    firstGrid.current = gridKey; clearTimeout(st.cadenceTimer); Y.pause();
    st.q = newQuestion(); st.answered = false; st.transport = false; st.playing = -1;
    if (st.q) { st.chordSlots = st.q.units.map(() => null); st.melSlots = st.q.melody ? st.q.song.melody.degrees.map(() => null) : []; st.selChord = 0; st.selMel = 0; st.anchor = null; st.loopOn = false; st.loopRange = null; Y.cue(st.q.song.youtube, st.q.song.start); }
    rerender();
  }, [gridKey, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  /* работа над ошибками: вопрос после загрузки списка */
  useEffect(() => { if (mistakes && loaded && mk.loaded) fns.current.next(); }, [mistakes, loaded, mk.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  /* смена лада из меню: новый вопрос */
  const firstMode = useRef(mode);
  useEffect(() => { if (firstMode.current !== mode && loaded) { firstMode.current = mode; fns.current.next(); } }, [mode, loaded]);
  /* выделение тактов протяжкой мыши */
  useEffect(() => {
    let dragging = false, dragStart = -1, moved = false;
    const idx = el => { const s = el && el.closest && el.closest('.slot'); const sheet = sheetRef.current; return s && sheet ? Array.prototype.indexOf.call(sheet.querySelectorAll('.slot'), s) : -1; };
    const down = ev => { const q = st.q; if (!q || !q.chords || st.answered || ev.button !== 0) return; const i = idx(ev.target); if (i < 0) return; dragging = true; moved = false; dragStart = i; };
    const move = ev => {
      if (!dragging) return;
      const i = idx(document.elementFromPoint(ev.clientX, ev.clientY)); if (i < 0 || (i === st.selChord && st.anchor === (i === dragStart ? null : dragStart))) return;
      if (i !== dragStart) { moved = true; st.anchor = dragStart; } else st.anchor = null;
      st.selChord = i; st.active = 'chords'; rerender();
    };
    const up = () => { if (!dragging) return; dragging = false; if (moved) { st.transport = true; rerender(); } };
    const click = ev => { if (st.transport && !ev.target.closest('.slot') && !ev.target.closest('.sel-pop')) { st.transport = false; rerender(); } };
    document.addEventListener('pointerdown', down); document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('click', click);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('click', click); };
  }, [st]);
  /* клавиатура */
  useEffect(() => {
    const onKey = ev => {
      if (/^(SELECT|INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
      const q = st.q, f = fns.current;
      if (ev.key === 'Enter') { ev.preventDefault(); if (q && !st.answered && complete()) f.check(); else if (st.answered) f.next(); }
      else if (ev.key === 't' || ev.key === 'е') { if (q) f.playCadence(false); }
      else if (ev.key === ' ') { if (q) { ev.preventDefault(); if (st.active === 'melody' && q.melody) f.playPhrase(); else if (q.chords) f.playSelection(); } }
      else if ((ev.key === 'l' || ev.key === 'д') && q && q.chords) f.toggleLoop();
      else if (ev.key === 'Backspace' && q && !st.answered) {
        ev.preventDefault();
        if (st.active === 'chords') { if (st.chordSlots[st.selChord]) st.chordSlots[st.selChord] = null; else st.selChord = Math.max(0, st.selChord - 1); st.anchor = null; }
        else { if (st.melSlots[st.selMel]) st.melSlots[st.selMel] = null; else st.selMel = Math.max(0, st.selMel - 1); }
        st.transport = false; rerender();
      }
      else if ((ev.key === '-' || ev.key === 'b' || ev.key === 'и') && q && !st.answered) { st.pendingAcc = '♭'; }
      else if ((ev.key === '+' || ev.key === '=' || ev.key === '#') && q && !st.answered) { st.pendingAcc = '♯'; }
      else if (/^[1-7]$/.test(ev.key) && q && !st.answered) {
        ev.preventDefault(); const d = +ev.key; const acc = st.pendingAcc; st.pendingAcc = null;
        if (st.active === 'melody' && q.melody) {
          const s = (T.SCALES[q.mode][d - 1] + (acc === '♭' ? -1 : acc === '♯' ? 1 : 0) + 12) % 12;
          const deg = T.DEGREES[q.mode].find(x => x.st === s); if (deg) f.fillMel(deg.label);
        } else if (q.chords) {
          const diat = q.mode === 'major' ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] : ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'VII'];
          const sym = diat[d - 1]; if (q.vocab.includes(sym)) f.fillChord(sym); else toast(tx('noSuchChord', { x: sym }));
        }
      }
      else if ((ev.key === '%' || ev.key === 'r' || ev.key === 'к') && q && q.chords && !st.answered && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); if (st.selChord > 0 && st.chordSlots[st.selChord - 1]) f.fillChord(st.chordSlots[st.selChord - 1]); }
      else if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && q) {
        ev.preventDefault(); const dir = ev.key === 'ArrowLeft' ? -1 : 1;
        if (st.active === 'chords') { if (ev.shiftKey) { if (st.anchor == null) st.anchor = st.selChord; } else st.anchor = null; st.selChord = Math.max(0, Math.min(st.chordSlots.length - 1, st.selChord + dir)); }
        else st.selMel = Math.max(0, Math.min(st.melSlots.length - 1, st.selMel + dir));
        st.transport = true; rerender();
      }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps
  /* панель над выделением: позиция после отрисовки */
  useLayoutEffect(() => {
    const tr = trRef.current, q = st.q; if (!tr || !q || !q.chords) return;
    const [ra, rb] = selRange(); const slots = sheetRef.current ? sheetRef.current.querySelectorAll('.slot') : [];
    if (!slots[ra] || !slots[rb] || !chordsRef.current) return;
    const wr = chordsRef.current.getBoundingClientRect(), a = slots[ra].getBoundingClientRect(), b = slots[rb].getBoundingClientRect();
    const center = (a.left + b.right) / 2 - wr.left; const w = tr.offsetWidth;
    tr.style.left = Math.max(0, Math.min(wr.width - w, center - w / 2)) + 'px';
  });

  const q = st.q, answered = st.answered, s = q && q.song;
  const bars = u => q.units.slice(0, u + 1).filter(x => x.barStart).length;
  const [ra, rb] = q ? selRange() : [0, 0];
  const all = answered && q && (!q.chords || q.units.every((u, i) => u.sym === st.chordSlots[i])) && (!q.melody || q.song.melody.degrees.every((d, i) => d === st.melSlots[i]));
  // строки по 4 такта
  const rows = []; let row = null, barsInRow = 0;
  if (q && q.chords) q.units.forEach((u, i) => { if (u.barStart && (!row || barsInRow >= 4)) { row = []; rows.push(row); barsInRow = 0; } if (u.barStart) barsInRow++; if (!row) { row = []; rows.push(row); } row.push(i); });
  const groups = [[], [], []]; if (q && q.chords) q.vocab.forEach(sym => groups[isChrom(sym, q.mode) ? 2 : /7|ø|sus/.test(sym) ? 1 : 0].push(sym));
  const empty = loaded && !q;
  const exhausted = !R && !mistakes && !tonus && empty && allDone();  // песни уровня есть, но все пройдены
  const noMistakes = mistakes && mk.loaded && loaded && !q;
  let where = '';
  if (empty) { const counts = {}; allSongs().filter(x => (!isMel || (x.melody && x.melody.degrees.length))).forEach(x => { const k = (x.key.mode === 'major' ? 'major' : 'minor') + (isMel ? '' : ' ' + x.level); counts[k] = (counts[k] || 0) + 1; }); where = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([k, n]) => `${k}: ${n}`).join(', '); }

  function slot(i, mel) {
    const sel = mel ? (i === st.selMel && st.active === 'melody') : (i === st.selChord && st.active === 'chords');
    let cls = 'slot' + (mel ? ' note' : '') + (sel && !answered ? ' sel' : ''); const style = {};
    if (!mel) {
      const u = q.units[i]; style.flexGrow = (u.beats / (q.song.beatsPerBar || 4) * 100).toFixed(3);
      if (u.barStart) cls += ' bar-start'; if (u.beats < (q.song.beatsPerBar || 4)) cls += ' partial';
      if (i >= ra && i <= rb && ra !== rb) { cls += ' in-range'; if (i === ra) cls += ' range-first'; if (i === rb) cls += ' range-last'; }
      if (st.loopOn && st.loopRange && i >= st.loopRange[0] && i <= st.loopRange[1]) { cls += ' looping'; if (i === st.loopRange[0]) cls += ' loop-first'; if (i === st.loopRange[1]) cls += ' loop-last'; }
      if (i === st.playing) cls += ' playing';
    }
    const truth = mel ? q.song.melody.degrees[i] : q.units[i].sym;
    const shown = mel ? truth : T.displayToken(q.units[i].token);
    const given = mel ? st.melSlots[i] : st.chordSlots[i];
    if (answered) {
      const ok = truth === given;
      return <button key={i} className={cls + (ok ? ' correct' : ' wrong')} style={style} onClick={() => { if (!mel) playBar(i); }}><span>{shown}</span>{!ok && <small>your answer: {given}</small>}</button>;
    }
    return <button key={i} className={cls} style={style} onClick={ev => { if (mel) st.selMel = i; else { if (ev.shiftKey) { if (st.anchor == null) st.anchor = st.selChord; } else st.anchor = null; st.selChord = i; } st.active = mel ? 'melody' : 'chords'; st.transport = !mel; rerender(); }}>{given ? <span>{given}</span> : <span className="q">?</span>}</button>;
  }

  return (
    <>
      {!R && <SessionStrip session={session} noun={tx('song')} active={!!q} idle={loaded && !q} note={mistakes ? tx('mistakesNote') : tonus ? tx('tonusNote') : (q && st.repeat && allDone() ? tx('repeatNote') : null)} right={<><MistakesBadge exercise={isMel ? 'melodies' : 'songs'} mode={mode} level={isMel ? null : page.prog().level} href={(isMel ? '/melodies' : '/songs') + '?mode=' + mode + '&mistakes=1'} on={!!mistakes} /><HelpPopover exercise={isMel ? 'melodies' : 'songs'} /><SettingsPopover ctx={page} hidden={isMel && !mistakes} mistakes={{ on: !!mistakes, count: mk.count, tonus: isMel ? null : !!tonus }} /></>} />}
      {!R && !isMel && !mistakes && !tonus && <LevelPath levels={page.levels()} level={page.prog().level} maxLevel={page.prog().maxLevel} history={(page.prog().byLevel || {})[Math.max(page.prog().maxLevel || 1, page.prog().level)] || page.prog().history} W={settings.levelUpWindow || 20} NEED={settings.levelUpNeed || 16} onSelect={n => page.setLevel(n)} collapsible />}
      {levelUpOpen && <LevelUpBanner ctx={page} onClose={() => setLevelUpOpen(false)} />}
      {noMistakes && <MistakesEmpty href={(isMel ? '/melodies' : '/songs') + '?mode=' + mode} />}
      <section className={EX.STAGE}>
        {ipWarning && <div className="qinfo"><div className="empty-state"><div className="lead">{tx('ipWarn')}</div><div className="meta">{tx.rich('ipWarnOpen', { a: c => <a href={'http://localhost:' + window.location.port + window.location.pathname}>{c}</a> })}</div></div></div>}
        {!loaded && <div className="skeleton"><div className="sk-row" /><div className="sk-chips"><i /><i /><i /><i /><i /></div><div className="sk-btn" /></div>}
        {exhausted && (
          <div className="qinfo"><div className="empty-state">
            <div className="lead">{isMel ? tx('melDone') : tx('songsDone')}</div>
            <div className="meta">{tx('corpusHint')}</div>
            <div className="actions" style={{ marginTop: 16 }}>
              <Button variant="primary" size="primary" onClick={() => { st.repeat = true; next(); }}>{tx('repeatPassed')}</Button>
              {mistakeCount > 0 && <Button variant="quiet" asChild><a href={(isMel ? '/melodies' : '/songs') + '?mode=' + mode + '&mistakes=1'}>{tx('mistakesBtn', { n: mistakeCount })}</a></Button>}
            </div>
          </div></div>
        )}
        {!R && !mistakes && empty && !exhausted && <div className="qinfo"><div className="empty-state"><div className="lead">{isMel ? tx('melEmpty') : tx('songsEmpty')}</div><div className="meta">{where ? tx('availHint', { where }) : tx('corpusGrowing')}</div></div></div>}
        {q && q.chords && (
          <div id="chordsBlock" ref={chordsRef}>
            <div className="sheet-wrap"><div className="sheet rows" ref={sheetRef}>{rows.map((r, ri) => <div key={ri} className="sheet-row">{r.map(i => slot(i, false))}</div>)}</div></div>
            {st.transport && !answered && (
              <div className="sel-pop" ref={trRef}>
                <button className="btn quiet mini" onClick={playSelection}>{ra === rb ? tx('playBar', { n: bars(ra) }) : tx('playBars', { a: bars(ra), b: bars(rb) })}</button>
                <button className={'btn quiet mini' + (st.loopOn ? ' active' : '')} data-tip={tx('loopTip')} onClick={toggleLoop}>{tx('loop')}</button>
                <button className={'btn quiet mini' + (st.rate === 0.5 ? ' active' : '')} data-tip={tx('halfTip')} onClick={() => { st.rate = st.rate === 0.5 ? 1 : 0.5; Y.rate(st.rate); rerender(); }}>{st.rate === 0.5 ? '0.5× ✓' : '0.5×'}</button>
              </div>
            )}
            <div className="vocab">
              {groups.map((g, gi) => g.length ? (
                <div key={gi} className="vocab-group">
                  {g.map(sym => <button key={sym} className="chord" disabled={answered} onClick={() => fillChord(sym)}>{sym}</button>)}
                  {gi === 0 && <button className="chord repeat" data-tip={tx('repeatTip')} disabled={answered} onClick={() => { if (st.selChord > 0 && st.chordSlots[st.selChord - 1]) fillChord(st.chordSlots[st.selChord - 1]); }}>%</button>}
                </div>
              ) : null)}
            </div>
          </div>
        )}
        {q && q.melody && (
          <div id="melodyBlock" className={st.melPlaying ? 'playing' : ''}>
            {!isMel && <div className={EX.PARTLINE}><button className={EX.LINK} onClick={playPhrase}>{tx('listenPhrase')}</button></div>}
            <div className="sheet-wrap"><div className="sheet notes rows">{Array.from({ length: Math.ceil(s.melody.degrees.length / 4) }, (_, ri) => <div key={ri} className="sheet-row">{s.melody.degrees.slice(ri * 4, ri * 4 + 4).map((d, j) => slot(ri * 4 + j, true))}</div>)}</div></div>
            <div className="keys">{T.DEGREES[q.mode].map(d => <button key={d.label} className={'key small' + (/[♭♯♮]/.test(d.label) ? ' chrom' : '')} disabled={answered} onClick={() => fillMel(d.label)}>{d.label}</button>)}</div>
          </div>
        )}
        {q && (
          <div className={EX.ACTIONS} id="answerActions">
            {!answered && <Button variant="primary" size="primary" disabled={!complete()} onClick={check}>{tx('check')}</Button>}
            {answered && <Button variant="primary" size="primary" onClick={next}>{R ? tx('nextSong') : tx('next')}</Button>}
            {answered && !all && <Button onClick={retry}>{tx('fix')}</Button>}
          </div>
        )}
        <div className={EX.feedbackCls(answered, all)}>
          {answered && (
            <>
              <div className="text-lg"><b className="font-semibold">{all ? tx('yes') : tx('notQuite')}</b> {T.keyName(s.key.mode, s.key.tonic)}{q.chords ? ': ' + s.chords.map(c => T.letterName(s.key.mode, c.c, s.key.tonic)).join(' – ') : ''}.</div>
              {q.melody && <div className="text-ink-2 text-[15px] mt-1">{tx('melodyNotes', { notes: s.melody.degrees.map(d => T.NOTE_NAMES[(s.key.tonic + T.degreeByLabel(s.key.mode, d).st) % 12]).join(' ') })}</div>}
              <div className="text-ink-2 text-[15px] mt-0.5">{tx('onPiano')} <button className={EX.LINK} onClick={() => q.chords ? playChordsSynth(st.chordSlots) : playDegreesSynth(st.melSlots)}>{tx('yourVar')}</button> · <button className={EX.LINK} onClick={() => q.chords ? playChordsSynth(q.units.map(u => u.sym)) : playDegreesSynth(s.melody.degrees)}>{tx('correctVar')}</button></div>
            </>
          )}
        </div>
      </section>
      <div className="dockbar" hidden={!q}>
        <div className="dock-inner">
          <div className="player dock-player" ref={playerHost} />
          <div className="dock-info">
            <div className="song-title"><span>{s ? s.title : ''}</span> <span className="info up" tabIndex={0}>?<span className="tip">{s ? (isMel && s.melody ? tx('phraseInfo', { start: fmt(s.melody.start), end: fmt(s.melody.end), n: s.melody.degrees.length }) : tx('fragmentInfo', { start: fmt(s.start), end: fmt(s.end), n: q.units.filter(u => u.barStart).length })) : ''}</span></span></div>
            <div className="song-meta">{s ? s.artist + (s.section ? ', ' + sectionEn(s.section).replace(/^(\S)/, m => m.toLowerCase()) : '') : ''}</div>
          </div>
          <div className="dock-controls">
            <Button variant="primary" size="primary" onClick={() => playFragment()}>{tx('listenBtn')}</Button>
            <Button variant="quiet" data-tip={tx('tonicTip')} onClick={() => q && playCadence(false)}>{tx('tonicBtn')}</Button>
            <Button variant="quiet" data-tip={tx('noCadenceTip')} onClick={() => playFragment({ noCadence: true })}>{tx('noCadenceBtn')}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
