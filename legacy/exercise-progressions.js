/* Страница «Прогрессии» */
ET.ready.then(function () {
  'use strict';
  const T = window.Theory, P = window.Progressions, ET = window.ET, $ = ET.$;
  let q = null, answered = false, slots = [], sel = 0, lastEntry = null, autoTimer = null, unlocked = false;

  const page = ET.page({ exercise: 'progressions', levels: mode => P.PROG_LEVELS[mode], onReset: () => next(false) });
  const session = ET.session(10, 'Вопрос'); ET.settingsPopover();
  ET.onLeave(() => clearTimeout(autoTimer));

  function newQuestion() {
    const lvl = page.levelDef(), mode = page.mode;
    const pool = P.PROGRESSIONS.filter(p => p.mode === mode && p.level === page.prog().level);
    const entry = ET.weightedPick(pool, p => (1 + 3 * Math.max(0, ...p.chords.map(c => page.errRate(T.parseToken(c).symbol)))) * (p === lastEntry ? 0.25 : 1));
    lastEntry = entry;
    const tonicPc = Math.floor(Math.random() * 12);
    const hint = lvl.keyHint === 'cadence' ? T.CADENCE[mode] : [T.CADENCE[mode][0]];
    const voiced = T.voiceLead(hint.concat(entry.chords), mode, tonicPc);
    return { mode, tonicPc, entry, chords: entry.chords, hint: voiced.slice(0, hint.length), voiced: voiced.slice(hint.length), keyHint: lvl.keyHint, chordDur: lvl.chordDur, timbre: page.timbre(lvl) };
  }

  function play() {
    unlocked = true;
    const e = ET.audio(); let t = e.ctx.currentTime + 0.1;
    q.hint.forEach((c, i) => { const d = q.keyHint === 'cadence' ? (i === q.hint.length - 1 ? 0.9 : 0.6) : 1.0; e.playChord(q.timbre, c.notes, t, d); t += d; });
    t += 0.7;
    q.voiced.forEach((c, i) => { const d = i === q.voiced.length - 1 ? q.chordDur * 1.5 : q.chordDur; e.playChord(q.timbre, c.notes, t, d * 0.97); t += d; });
  }
  function playChord(i) { const e = ET.audio(); e.playChord(q.timbre, q.voiced[i].notes, e.ctx.currentTime + 0.05, q.chordDur * 1.3); }

  function render() {
    renderSlots();
    const vocab = $('#vocab'); vocab.innerHTML = '';
    const groups = [[], [], []];
    page.levelDef().vocab.forEach(sym => {
      const chrom = /\//.test(sym) || /^♭/.test(sym) || sym === 'N' || (q.mode === 'minor' && sym === 'I') || (q.mode === 'major' && sym === 'iv') || sym === 'vii°7';
      groups[chrom ? 2 : /7|ø|sus/.test(sym) ? 1 : 0].push(sym);
    });
    groups.forEach(g => {
      if (!g.length) return;
      const row = document.createElement('div'); row.className = 'vocab-group';
      g.forEach(sym => { const b = document.createElement('button'); b.className = 'chord'; b.textContent = sym; b.addEventListener('click', () => fill(sym)); row.appendChild(b); });
      vocab.appendChild(row);
    });
  }

  function renderSlots() {
    const el = $('#sheet'); el.innerHTML = '';
    q.chords.forEach((tok, i) => {
      const s = document.createElement('button');
      s.className = 'slot' + (i === sel && !answered ? ' sel' : '');
      if (answered) {
        const sym = T.parseToken(tok).symbol, ok = sym === slots[i];
        s.classList.add(ok ? 'correct' : 'wrong');
        s.innerHTML = `<span>${T.displayToken(tok)}</span>` + (ok ? '' : `<small>ваш вариант: ${slots[i]}</small>`);
        s.addEventListener('click', () => playChord(i));
      } else {
        s.innerHTML = slots[i] ? `<span>${slots[i]}</span>` : '<span class="q">?</span>';
        s.addEventListener('click', () => { sel = i; renderSlots(); });
      }
      el.appendChild(s);
    });
    $('#btnCheck').disabled = answered || slots.some(s => !s);
  }
  function fill(sym) {
    if (answered) return;
    slots[sel] = sym;
    const after = slots.findIndex((s, i) => !s && i > sel), any = slots.findIndex(s => !s);
    sel = after >= 0 ? after : any >= 0 ? any : Math.min(sel + 1, slots.length - 1);
    renderSlots();
  }

  function check() {
    if (!q || answered || slots.some(s => !s)) return;
    answered = true;
    let all = true;
    q.chords.forEach((tok, i) => { const sym = T.parseToken(tok).symbol; if (sym !== slots[i]) all = false; page.recordConfusion(sym, slots[i]); });
    const levelUp = page.recordResult(all); session.push(all);
    ET.logAnswer({ exercise: 'progressions', mode: q.mode, level: page.prog().level, correct: all, answer: slots.slice(), truth: q.chords.slice() });
    renderSlots();
    document.querySelectorAll('#vocab .chord').forEach(b => b.disabled = true);
    const fb = $('#feedback');
    fb.className = 'feedback show ' + (all ? 'ok' : 'bad');
    let html = `<div class="lead"><b>${all ? 'Верно.' : 'Не совсем.'}</b> ${T.keyName(q.mode, q.tonicPc)}: ${q.chords.map(c => T.letterName(q.mode, c, q.tonicPc)).join(' – ')}.</div>`;
    const where = [q.entry.name].concat(q.entry.examples).filter(Boolean).join('; ');
    if (where) html += `<div class="meta">${where}.</div>`;
    fb.innerHTML = html;
    $('#btnCheck').hidden = true; $('#btnNext').hidden = false; $('#btnRetry').hidden = all;
    if (!levelUp && ET.store.autoNext) { clearTimeout(autoTimer); autoTimer = setTimeout(next, all ? 1800 : 4500); }
  }

  function next(autoplay) {
    clearTimeout(autoTimer); session.nextIfDone();
    q = newQuestion(); answered = false; slots = q.chords.map(() => null); sel = 0; session.render(true);
    $('#feedback').className = 'feedback'; $('#btnCheck').hidden = false; $('#btnNext').hidden = true; $('#btnRetry').hidden = true;
    render();
    if (autoplay !== false && unlocked) play();
  }

  $('#btnPlay').addEventListener('click', () => q && play());
  $('#btnCheck').addEventListener('click', check);
  $('#btnNext').addEventListener('click', () => next());
  $('#btnRetry').addEventListener('click', () => {
    if (!q || !answered) return;
    clearTimeout(autoTimer); answered = false;
    slots = slots.map((v, i) => v === T.parseToken(q.chords[i]).symbol ? v : null); sel = Math.max(0, slots.findIndex(v => !v));
    $('#feedback').className = 'feedback'; $('#btnCheck').hidden = false; $('#btnNext').hidden = true; $('#btnRetry').hidden = true;
    render();
  });
  ET.listen(document, 'keydown', ev => {
    if (/^(SELECT|INPUT)$/.test(ev.target.tagName)) return;
    if (ev.key === 'Enter') { ev.preventDefault(); if (answered) next(); else if (!slots.some(s => !s)) check(); else play(); }
    else if (ev.key === 'r' || ev.key === 'к') { if (q) play(); }
    else if (ev.key === ' ' && q) { ev.preventDefault(); playChord(sel); }
    else if (ev.key === 'Backspace' && q && !answered) { ev.preventDefault(); slots[sel] = null; renderSlots(); }
    else if (ev.key === 'ArrowLeft' && q && !answered) { sel = Math.max(0, sel - 1); renderSlots(); }
    else if (ev.key === 'ArrowRight' && q && !answered) { sel = Math.min(slots.length - 1, sel + 1); renderSlots(); }
  });
  next(false);
});
