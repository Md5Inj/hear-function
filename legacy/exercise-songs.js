/* Страница «Песни»: фрагмент реальной записи через YouTube, аккорды по тактам и ступени мелодии. */
ET.ready.then(function () {
  'use strict';
  const T = window.Theory, P = window.Progressions, SB = window.Songs, ET = window.ET, $ = ET.$, Y = window.YTP;
  let q = null, answered = false, lastSong = null, autoTimer = null, played = false, cadenceTimer = null;
  let chordSlots = [], melSlots = [], selChord = 0, selMel = 0, active = 'chords';
  let anchor = null, loopOn = false, rate = 1, pendingAcc = null, loopRange = null; // loopRange: [от, до] зацикленных единиц // выделение диапазона тактов (anchor..selChord), зацикливание, скорость
  const SESSION = 10; let session = [];  // результаты текущей серии: true/false
  function renderSession() {
    const steps = $('#sessionSteps'); if (!steps) return;
    steps.innerHTML = '';
    for (let i = 0; i < SESSION; i++) { const d = document.createElement('i'); if (i < session.length) d.className = session[i] ? 'y' : 'n'; else if (i === session.length && q) d.className = 'cur'; steps.appendChild(d); }
    const right = session.filter(Boolean).length;
    $('#sessionText').innerHTML = q ? `Песня <b>${Math.min(session.length + 1, SESSION)}</b> из ${SESSION} <span class="cnt ok" data-tip="Верно">${right}</span><span class="cnt bad" data-tip="Ошибок">${session.length - right}</span>${allDone() ? ' <span class="muted">· все песни уровня уже пройдены, идут повторно</span>' : ''}` : `Серия из ${SESSION} песен`;
  }

  const TASK = document.body.dataset.task || 'chords';
  const page = ET.page({ exercise: TASK === 'melody' ? 'melodies' : 'songs', levels: mode => SB.SONG_LEVELS[mode], onReset: next });

  const allSongs = () => ET.store.songs.map(s => { const e = SB.expand(s); e.level = SB.levelFor(e) || e.level; return e; }).filter(s => SB.levelFor(s));
  const task = () => TASK;
  const wantChords = () => task() !== 'melody';
  const wantMelody = s => task() !== 'chords' && s.melody && s.melody.degrees.length;
  const unavailable = new Set(); // ролики, которые не загрузились в этой сессии
  const seenKey = s => (TASK === 'melody' ? 'melodies' : 'songs') + ':' + s.id;
  const fits = (s, lvl) => !unavailable.has(s.id) && s.key.mode === page.mode && (TASK === 'melody' ? (s.melody && s.melody.degrees.length) : s.level === (lvl || page.prog().level));
  // показанные песни не повторяются; когда все пройдены, снова берём все
  /* Пул уровня: фрагменты ровно этого уровня; если их мало, добавляем предыдущие уровни */
  const poolAll = () => {
    if (TASK === 'melody') return allSongs().filter(s => fits(s));
    const L = page.prog().level, maxL = page.levels().length, all = allSongs();
    let out = all.filter(s => fits(s, L));
    // мало песен: добираем только более простые уровни, более сложные — никогда
    for (let lvl = L - 1; lvl >= 1 && out.length < 8; lvl--) out = out.concat(all.filter(s => fits(s, lvl)));
    return out;
  };
  const pool = () => { const all = poolAll(); const fresh = all.filter(s => !ET.store.seen.has(seenKey(s))); return fresh.length ? fresh : all; };
  const allDone = () => { const all = poolAll(); return all.length > 0 && all.every(s => ET.store.seen.has(seenKey(s))); };
  const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  let forcedSongId = new URLSearchParams(location.search).get('song');
  function newQuestion() {
    let songs = pool();
    if (forcedSongId) {
      const f = allSongs().find(s => s.id === forcedSongId); forcedSongId = null;
      if (f) { if (f.key.mode !== page.mode) { page.mode = ET.store.mode = f.key.mode; ET.save(); page.renderSettings(); page.renderLevels(); } if (TASK !== 'melody') { page.prog().level = f.level; page.renderLevels(); } songs = [f]; }
      history.replaceState(null, '', location.pathname);
    }
    if (!songs.length) return null;
    const song = ET.weightedPick(songs, s => (1 + 3 * Math.max(0, ...s.chords.map(c => page.errRate(T.parseToken(c.c).symbol)))) * (s.id === lastSong && songs.length > 1 ? 0.2 : 1));
    lastSong = song.id;
    const vocab = page.levelDef().vocab.slice();
    song.chords.forEach(c => { const sym = T.parseToken(c.c).symbol; if (!vocab.includes(sym)) vocab.push(sym); });
    return { song, units: buildUnits(song), mode: page.mode, vocab, chords: wantChords(), melody: !!wantMelody(song) };
  }

  /* Единицы ответа: каждый аккорд разрезан по тактовым чертам, т.е. один слот = один такт (или часть такта при смене внутри него) */
  function buildUnits(song) {
    const bpb = song.beatsPerBar || 4, beat = 60 / song.bpm, units = [];
    let pos = 0; // позиция в долях от начала фрагмента
    song.chords.forEach((c, ci) => {
      let left = c.beats != null ? c.beats : bpb;
      while (left > 1e-6) {
        const room = bpb - (pos % bpb); const take = Math.min(left, room);
        units.push({ ci, beats: take, t0: song.start + pos * beat, t1: song.start + (pos + take) * beat, barStart: Math.abs(pos % bpb) < 1e-6, sym: T.parseToken(c.c).symbol, token: c.c });
        pos += take; left -= take;
      }
    });
    return units;
  }
  const unitSpan = i => [q.units[i].t0, q.units[i].t1];

  /* Каденция в тональности песни на синтезаторе. Возвращает её длительность в секундах. */
  function playCadence(full) {
    const e = ET.audio(); let t = e.ctx.currentTime + 0.05;
    const mode = q.song.key.mode, tonic = q.song.key.tonic;
    const chords = full ? T.CADENCE[mode] : [T.CADENCE[mode][0]];
    T.voiceLead(chords, mode, tonic).forEach((c, i) => { const d = i === chords.length - 1 ? 1.1 : 0.6; e.playChord('piano', c.notes, t, d); t += d; });
    return t - e.ctx.currentTime;
  }
  /* Каденция, затем запись: видео заранее загружается и ставится на паузу, чтобы стартовать точно после каденции. */
  /* Что играет «Слушать»: на странице аккордов весь фрагмент, на странице мелодий только фразу */
  function playRangeOf(s) { return TASK === 'melody' && s.melody ? [s.melody.start, s.melody.end] : [s.start, s.end]; }
  function playFragment(opts) {
    opts = opts || {}; played = true;
    clearTimeout(cadenceTimer);
    const s = q.song; const [a, b] = playRangeOf(s);
    if (opts.noCadence) return Y.playRange(s.youtube, a, b);
    const cadenceEnd = performance.now() + playCadence(true) * 1000 + 300;
    Y.prepare(s.youtube, a, b).then(() => {
      if (q.song !== s) return;
      cadenceTimer = setTimeout(() => Y.resume(b), Math.max(0, cadenceEnd - performance.now()));
    });
  }
  function playBar(i) { clearTimeout(cadenceTimer); const [a, b] = unitSpan(i); Y.playRange(q.song.youtube, a, b); }
  function selRange() { const a = anchor == null ? selChord : Math.min(anchor, selChord), b = anchor == null ? selChord : Math.max(anchor, selChord); return [a, b]; }
  function toggleLoop() {
    loopOn = !loopOn;
    loopRange = loopOn ? selRange() : null;
    renderChordSlots(); updateTransport();
    if (loopOn) playSelection(); else Y.setLoop(false);
  }
  function playSelection() {
    if (!q || !q.chords) return; clearTimeout(cadenceTimer);
    const [ra, rb] = loopOn && loopRange ? loopRange : selRange();
    Y.playRange(q.song.youtube, q.units[ra].t0, q.units[rb].t1, loopOn); Y.rate(rate);
  }
  /* Всплывающая панель над выделенными тактами */
  function updateTransport(show) {
    const tr = $('#transport'); if (!tr) return;
    if (!q || !q.chords) { tr.hidden = true; return; }
    const [ra, rb] = selRange(); const bars = u => q.units.slice(0, u + 1).filter(x => x.barStart).length;
    $('#btnPlaySel').textContent = ra === rb ? `▶ такт ${bars(ra)}` : `▶ такты ${bars(ra)}–${bars(rb)}`;
    $('#btnLoop').classList.toggle('active', loopOn);
    const half = $('[data-rate="0.5"]'); half.classList.toggle('active', rate === 0.5); half.textContent = rate === 0.5 ? '0.5× ✓' : '0.5×';
    if (show === false) { tr.hidden = true; return; }
    const slots = document.querySelectorAll('#sheet .slot'); if (!slots[ra] || !slots[rb]) return;
    const wrap = $('#chordsBlock'), wr = wrap.getBoundingClientRect(), a = slots[ra].getBoundingClientRect(), b = slots[rb].getBoundingClientRect();
    tr.hidden = false;
    const center = (a.left + b.right) / 2 - wr.left; const w = tr.offsetWidth;
    tr.style.left = Math.max(0, Math.min(wr.width - w, center - w / 2)) + 'px';
  }
  ET.listen(document, 'click', ev => { const tr = $('#transport'); if (tr && !tr.hidden && !ev.target.closest('.slot') && !ev.target.closest('#transport')) tr.hidden = true; });
  /* Сыграть последовательность аккордов (по единицам-тактам) на пианино в тональности песни */
  function playChordsSynth(symbols) {
    clearTimeout(cadenceTimer); Y.pause();
    const e = ET.audio(); const s = q.song, beat = 60 / s.bpm; let t = e.ctx.currentTime + 0.05;
    const tokens = symbols.map((sym, i) => sym || 'I'); // пустых быть не должно, страховка
    const voiced = T.voiceLead(tokens, s.key.mode, s.key.tonic);
    voiced.forEach((v, i) => { const d = q.units[i].beats * beat; e.playChord('piano', v.notes, t, d * 0.95); t += d; });
  }
  function playDegreesSynth(labels) {
    clearTimeout(cadenceTimer); Y.pause();
    const e = ET.audio(); const s = q.song; let t = e.ctx.currentTime + 0.05;
    const base = T.tonicMidi(s.key.tonic) + 12;
    labels.forEach(l => { const d = T.degreeByLabel(s.key.mode, l); if (d) e.playNote('piano', base + d.st, t, 0.42, 0.5); t += 0.45; });
  }
  function playPhrase() { clearTimeout(cadenceTimer); const m = q.song.melody; Y.playRange(q.song.youtube, m.start, m.end); }

  /* Подсветка звучащего такта и бегунок */
  ET.interval(() => {
    if (!q) return;
    const t = Y.state() === 1 && Y.currentId === q.song.youtube ? Y.time() : -1;
    if (q.chords) {
      document.querySelectorAll('#sheet .slot').forEach((el, i) => {
        const [a, b] = unitSpan(i); const on = t >= a && t < b;
        if (on && !el.classList.contains('playing')) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        el.classList.toggle('playing', on);
      });
    }
    if (q.melody) { const m = q.song.melody; $('#melodyBlock').classList.toggle('playing', t >= m.start && t < m.end); }
  }, 60);

  const isChrom = sym => /\//.test(sym) || /^♭/.test(sym) || sym === 'N' || (q.mode === 'minor' && sym === 'I') || (q.mode === 'major' && sym === 'iv') || sym === 'vii°7';

  function render() {
    const s = q.song;
    $('#songTitle').textContent = s.title;
    $('#songMeta').textContent = s.artist + (s.section ? ', ' + s.section.replace(/^(\S)/, m => m.toLowerCase()) : '');
    $('#songRange').textContent = TASK === 'melody' && s.melody
      ? `Фраза ${fmt(s.melody.start)}–${fmt(s.melody.end)}, ${s.melody.degrees.length} нот. «Слушать»: каденция в тональности песни, затем фраза. Ответ: ступень каждой ноты по порядку.`
      : `Фрагмент ${fmt(s.start)}–${fmt(s.end)}, ${q.units.filter(u => u.barStart).length} тактов. «Слушать»: каденция в тональности песни, затем запись. Клик по такту играет только его. Знак % повторяет аккорд предыдущего такта.`;
    Y.cue(s.youtube, s.start);

    $('#chordsBlock').hidden = !q.chords;
    if (q.chords) {
      renderChordSlots();
      const vocab = $('#vocab'); vocab.innerHTML = '';
      const groups = [[], [], []];
      q.vocab.forEach(sym => groups[isChrom(sym) ? 2 : /7|ø|sus/.test(sym) ? 1 : 0].push(sym));
      groups.forEach((g, gi) => {
        if (!g.length) return;
        const row = document.createElement('div'); row.className = 'vocab-group';
        g.forEach(sym => { const b = document.createElement('button'); b.className = 'chord'; b.textContent = sym; b.addEventListener('click', () => fillChord(sym)); row.appendChild(b); });
        if (gi === 0) { const r = document.createElement('button'); r.className = 'chord repeat'; r.textContent = '%'; r.title = 'Как в предыдущем такте'; r.addEventListener('click', () => { if (selChord > 0 && chordSlots[selChord - 1]) fillChord(chordSlots[selChord - 1]); }); row.appendChild(r); }
        vocab.appendChild(row);
      });
    }
    $('#melodyBlock').hidden = !q.melody;
    if (q.melody) {
      $('#melodyLyric').textContent = s.melody.lyric ? `Ступень каждой ноты фразы «${s.melody.lyric}»` : 'Ступень каждой ноты фразы';
      $('#btnPhrase').hidden = TASK === 'melody';
      renderMelSlots();
      const keys = $('#melKeys'); keys.innerHTML = '';
      T.DEGREES[q.mode].forEach(d => {
        const b = document.createElement('button'); b.className = 'key small' + (/[♭♯♮]/.test(d.label) ? ' chrom' : ''); b.textContent = d.label;
        b.addEventListener('click', () => fillMel(d.label)); keys.appendChild(b);
      });
    }
    updateCheck();
  }

  function slotButton(i, isMel) {
    const s = document.createElement('button');
    const sel = isMel ? (i === selMel && active === 'melody') : (i === selChord && active === 'chords');
    s.className = 'slot' + (isMel ? ' note' : '') + (sel && !answered ? ' sel' : '');
    if (!isMel) {
      const u = q.units[i]; s.style.flexGrow = (u.beats / (q.song.beatsPerBar || 4) * 100).toFixed(3);
      if (u.barStart) s.classList.add('bar-start'); if (u.beats < (q.song.beatsPerBar || 4)) s.classList.add('partial');
      const [ra, rb] = selRange(); if (i >= ra && i <= rb && ra !== rb) { s.classList.add('in-range'); if (i === ra) s.classList.add('range-first'); if (i === rb) s.classList.add('range-last'); }
      if (loopOn && loopRange && i >= loopRange[0] && i <= loopRange[1]) { s.classList.add('looping'); if (i === loopRange[0]) s.classList.add('loop-first'); if (i === loopRange[1]) s.classList.add('loop-last'); }
    }
    const truth = isMel ? q.song.melody.degrees[i] : q.units[i].sym;
    const shown = isMel ? truth : T.displayToken(q.units[i].token);
    const given = isMel ? melSlots[i] : chordSlots[i];
    if (answered) {
      const ok = truth === given;
      s.classList.add(ok ? 'correct' : 'wrong');
      s.innerHTML = `<span>${shown}</span>` + (ok ? '' : `<small>ваш вариант: ${given}</small>`);
      if (!isMel) s.addEventListener('click', () => playBar(i));
    } else {
      s.innerHTML = given ? `<span>${given}</span>` : '<span class="q">?</span>';
      s.addEventListener('click', ev => { if (isMel) selMel = i; else { if (ev.shiftKey) { if (anchor == null) anchor = selChord; } else anchor = null; selChord = i; } active = isMel ? 'melody' : 'chords'; renderChordSlots(); renderMelSlots(); updateTransport(); });
    }
    return s;
  }
  function renderChordSlots() {
    if (!q || !q.chords) return;
    const el = $('#sheet'); el.innerHTML = ''; el.classList.add('rows');
    // по 4 такта в ряд; слоты внутри ряда делят ширину пропорционально долям
    let row = null, barsInRow = 0;
    q.units.forEach((u, i) => {
      if (u.barStart && (!row || barsInRow >= 4)) { row = document.createElement('div'); row.className = 'sheet-row'; el.appendChild(row); barsInRow = 0; }
      if (u.barStart) barsInRow++;
      if (!row) { row = document.createElement('div'); row.className = 'sheet-row'; el.appendChild(row); }
      row.appendChild(slotButton(i, false));
    });
    const selEl = el.querySelectorAll('.slot')[selChord]; if (selEl && active === 'chords') selEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function renderMelSlots() {
    if (!q || !q.melody) return;
    const el = $('#melSheet'); el.innerHTML = ''; el.classList.add('rows');
    let row = null;
    q.song.melody.degrees.forEach((d, i) => {
      if (i % 4 === 0) { row = document.createElement('div'); row.className = 'sheet-row'; el.appendChild(row); }
      row.appendChild(slotButton(i, true));
    });
  }
  function advance(slots, sel) {
    const after = slots.findIndex((s, i) => !s && i > sel), any = slots.findIndex(s => !s);
    return after >= 0 ? after : any >= 0 ? any : Math.min(sel + 1, slots.length - 1);
  }
  function fillChord(sym) { if (answered || !q.chords) return; chordSlots[selChord] = sym; selChord = advance(chordSlots, selChord); active = 'chords'; renderChordSlots(); renderMelSlots(); updateCheck(); }
  function fillMel(label) { if (answered || !q.melody) return; melSlots[selMel] = label; selMel = advance(melSlots, selMel); active = 'melody'; renderChordSlots(); renderMelSlots(); updateCheck(); }
  const complete = () => (!q.chords || !chordSlots.some(s => !s)) && (!q.melody || !melSlots.some(s => !s));
  function updateCheck() { $('#btnCheck').disabled = answered || !complete(); }

  function check() {
    if (!q || answered || !complete()) return;
    answered = true;
    let all = true;
    if (q.chords) q.units.forEach((u, i) => { if (u.sym !== chordSlots[i]) all = false; page.recordConfusion(u.sym, chordSlots[i]); });
    if (q.melody) q.song.melody.degrees.forEach((d, i) => { if (d !== melSlots[i]) all = false; page.recordConfusion('♪' + d, '♪' + melSlots[i]); });
    const levelUp = page.recordResult(all);
    ET.logAnswer({ exercise: TASK === 'melody' ? 'melodies' : 'songs', mode: q.mode, level: page.prog().level, songId: seenKey(q.song).split(':')[1], title: q.song.title, artist: q.song.artist, correct: all,
      answer: q.chords ? chordSlots.slice() : melSlots.slice(), truth: q.chords ? q.units.map(u => u.sym) : q.song.melody.degrees });
    session.push(all); if (session.length >= SESSION) { ET.toast(`Серия завершена: верно ${session.filter(Boolean).length} из ${SESSION}`); }
    renderSession();
    renderChordSlots(); renderMelSlots();
    document.querySelectorAll('#vocab .chord, #melKeys .key').forEach(b => b.disabled = true);
    const s = q.song, tonic = s.key.tonic;
    const fb = $('#feedback');
    fb.className = 'feedback show ' + (all ? 'ok' : 'bad');
    let html = `<div class="lead"><b>${all ? 'Верно.' : 'Не совсем.'}</b> ${T.keyName(s.key.mode, tonic)}`;
    if (q.chords) html += `: ${s.chords.map(c => T.letterName(s.key.mode, c.c, tonic)).join(' – ')}`;
    html += '.</div>';
    if (q.melody) html += `<div class="meta">Ноты мелодии: ${s.melody.degrees.map(d => T.NOTE_NAMES[(tonic + T.degreeByLabel(s.key.mode, d).st) % 12]).join(' ')}.</div>`;
    if (s.draft) html += `<div class="meta">Разметка этой песни не откалибрована по записи: <a href="editor.html?id=${encodeURIComponent(s.id)}">подогнать в редакторе</a>.</div>`;
    html += `<div class="meta">На пианино: <button class="link" id="btnMine">ваш вариант</button> · <button class="link" id="btnTruth">правильный</button> · <a href="editor.html?id=${encodeURIComponent(s.id)}">открыть в редакторе</a></div>`;
    fb.innerHTML = html;
    $('#btnMine').addEventListener('click', () => q.chords ? playChordsSynth(chordSlots) : playDegreesSynth(melSlots));
    $('#btnTruth').addEventListener('click', () => q.chords ? playChordsSynth(q.units.map(u => u.sym)) : playDegreesSynth(s.melody.degrees));
    $('#btnCheck').hidden = true; $('#btnNext').hidden = false; $('#btnRetry').hidden = all;
    if (!levelUp && ET.store.songAutoNext) { clearTimeout(autoTimer); autoTimer = setTimeout(next, all ? 6000 : 12000); }
  }

  function next() {
    clearTimeout(autoTimer); clearTimeout(cadenceTimer); Y.pause();
    if (session.length >= SESSION) session = [];
    q = newQuestion();
    renderSession();
    $('#feedback').className = 'feedback';
    $('#btnCheck').hidden = false; $('#btnNext').hidden = true;
    const empty = !q; if (empty && $('#skeleton')) $('#skeleton').remove();
    $('#answerActions').hidden = empty; document.querySelector('.dockbar').hidden = empty;
    if (empty) {
      $('#chordsBlock').hidden = true; $('#melodyBlock').hidden = true;
      $('#sheet').innerHTML = ''; $('#vocab').innerHTML = ''; $('#songRange').textContent = '';
      // где песни есть
      const counts = {};
      allSongs().filter(s => (TASK !== 'melody' || (s.melody && s.melody.degrees.length))).forEach(s => { const k = (s.key.mode === 'major' ? 'мажор' : 'минор') + (TASK === 'melody' ? '' : ' ' + s.level); counts[k] = (counts[k] || 0) + 1; });
      const where = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'ru', { numeric: true })).map(([k, n]) => `${k}: ${n}`).join(', ');
      $('#qinfo').innerHTML = `<div class="empty-state"><div class="lead">${TASK === 'melody' ? 'Для этого лада и уровня мелодий пока нет.' : 'Для этого лада и уровня песен пока нет.'}</div><div class="meta">${where ? 'Есть: ' + where + '. Лад и уровень меняются в настройках (шестерёнка).' : 'Корпус ещё пополняется.'}</div></div>`;
      return;
    }
    $('#qinfo').innerHTML = ''; if ($('#skeleton')) $('#skeleton').remove();
    answered = false;
    chordSlots = q.units.map(() => null); melSlots = q.melody ? q.song.melody.degrees.map(() => null) : [];
    selChord = 0; selMel = 0; active = q.chords ? 'chords' : 'melody'; anchor = null; loopOn = false; loopRange = null; rate = 1; Y.rate(1);
    render(); updateTransport(false);
    if (played && Y.ready) playFragment();
  }

  const auto = $('#autoNext');
  if (auto) { auto.checked = !!ET.store.songAutoNext; auto.addEventListener('change', () => { ET.store.songAutoNext = auto.checked; ET.save(); }); }
  ET.settingsPopover();
  /* Выделение тактов протяжкой мыши */
  (function () {
    const sheet = $('#sheet'); if (!sheet) return;
    let dragging = false, dragStart = -1, moved = false;
    const idx = el => { const s = el && el.closest('.slot'); return s ? Array.prototype.indexOf.call(sheet.querySelectorAll('.slot'), s) : -1; };
    sheet.addEventListener('pointerdown', ev => { if (!q || !q.chords || answered || ev.button !== 0) return; const i = idx(ev.target); if (i < 0) return; dragging = true; moved = false; dragStart = i; });
    ET.listen(document, 'pointermove', ev => {
      if (!dragging) return;
      const i = idx(document.elementFromPoint(ev.clientX, ev.clientY)); if (i < 0 || i === selChord && anchor === (i === dragStart ? null : dragStart)) return;
      if (i !== dragStart) { moved = true; anchor = dragStart; } else anchor = null;
      selChord = i; active = 'chords'; renderChordSlots(); renderMelSlots();
    });
    ET.listen(document, 'pointerup', () => { if (!dragging) return; dragging = false; if (moved) { renderChordSlots(); updateTransport(); } });
  })();
  $('#btnPlay').addEventListener('click', () => q && playFragment());
  if ($('#transport')) {
    $('#btnPlaySel').addEventListener('click', playSelection);
    $('#btnLoop').addEventListener('click', () => toggleLoop());
    document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => { rate = rate === +b.dataset.rate && b.dataset.rate === '0.5' ? 1 : +b.dataset.rate; Y.rate(rate); updateTransport(); }));
  }
  $('#btnNoCadence').addEventListener('click', () => q && playFragment({ noCadence: true }));
  $('#btnTonic').addEventListener('click', () => q && playCadence(false));
  $('#btnPhrase').addEventListener('click', () => q && q.melody && playPhrase());
  $('#btnCheck').addEventListener('click', check);
  const badPop = $('#badPop');
  if ($('#btnBad')) $('#btnBad').addEventListener('click', ev => { ev.stopPropagation(); if (q) badPop.hidden = !badPop.hidden; });
  if (badPop) ET.listen(document, 'click', ev => { if (!badPop.hidden && !badPop.contains(ev.target)) badPop.hidden = true; });
  if (badPop) badPop.querySelectorAll('[data-reason]').forEach(b => b.addEventListener('click', async () => {
    if (!q) return;
    const s = q.song; badPop.hidden = true;
    const flag = { id: s.id, youtube: s.youtube, start: s.start, task: TASK, reason: b.dataset.reason, title: s.title, artist: s.artist, mode: s.key.mode, level: s.level,
      answer: TASK === 'melody' ? melSlots.slice() : chordSlots.slice() };
    try { await ET.api('POST', '/flag', flag); ET.toast('Отмечено: фрагмент скрыт из корпуса'); }
    catch (e) { ET.toast('Не удалось отправить отметку: ' + e.message); }
    ET.store.songs = ET.store.songs.filter(x => x.id !== s.id);
    next();
  }));
  $('#btnNext').addEventListener('click', next);
  /* Исправить: оставить верные ответы, стереть ошибочные и отвечать заново (в серии остаётся первая попытка) */
  $('#btnRetry').addEventListener('click', () => {
    if (!q || !answered) return;
    clearTimeout(autoTimer); answered = false;
    if (q.chords) { chordSlots = chordSlots.map((v, i) => v === q.units[i].sym ? v : null); selChord = Math.max(0, chordSlots.findIndex(v => !v)); }
    if (q.melody) { melSlots = melSlots.map((v, i) => v === q.song.melody.degrees[i] ? v : null); selMel = Math.max(0, melSlots.findIndex(v => !v)); }
    active = q.chords && chordSlots.some(v => !v) ? 'chords' : 'melody'; anchor = null;
    $('#feedback').className = 'feedback'; $('#btnCheck').hidden = false; $('#btnNext').hidden = true; $('#btnRetry').hidden = true;
    render();
  });
  ET.listen(document, 'keydown', ev => {
    if (/^(SELECT|INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
    if (ev.key === 'Enter') { ev.preventDefault(); if (q && !answered && complete()) check(); else if (answered) next(); }
    else if (ev.key === 't' || ev.key === 'е') { if (q) playCadence(false); }
    else if (ev.key === ' ') { if (q) { ev.preventDefault(); if (active === 'melody' && q.melody) playPhrase(); else if (q.chords) playSelection(); } }
    else if ((ev.key === 'l' || ev.key === 'д') && q && q.chords) toggleLoop();
    else if (ev.key === 'Backspace' && q && !answered) {
      ev.preventDefault();
      if (active === 'chords') { if (chordSlots[selChord]) chordSlots[selChord] = null; else selChord = Math.max(0, selChord - 1); anchor = null; }
      else { if (melSlots[selMel]) melSlots[selMel] = null; else selMel = Math.max(0, selMel - 1); }
      renderChordSlots(); renderMelSlots(); updateCheck(); updateTransport(false);
    }
    else if ((ev.key === '-' || ev.key === 'b' || ev.key === 'и') && q && !answered) { pendingAcc = '♭'; }
    else if ((ev.key === '+' || ev.key === '=' || ev.key === '#') && q && !answered) { pendingAcc = '♯'; }
    else if (/^[1-7]$/.test(ev.key) && q && !answered) {
      ev.preventDefault(); const d = +ev.key; const acc = pendingAcc; pendingAcc = null;
      if (active === 'melody' && q.melody) {
        const st = (T.SCALES[q.mode][d - 1] + (acc === '♭' ? -1 : acc === '♯' ? 1 : 0) + 12) % 12;
        const deg = T.DEGREES[q.mode].find(x => x.st === st); if (deg) fillMel(deg.label);
      } else if (q.chords) {
        const diat = q.mode === 'major' ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] : ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'VII'];
        const sym = diat[d - 1]; if (q.vocab.includes(sym)) fillChord(sym); else ET.toast(`${sym} нет среди вариантов этого уровня`);
      }
    }
    else if ((ev.key === '%' || ev.key === 'r' || ev.key === 'к') && q && q.chords && !answered && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); if (selChord > 0 && chordSlots[selChord - 1]) fillChord(chordSlots[selChord - 1]); }
    else if (ev.key === 'ArrowLeft' && q) { ev.preventDefault(); if (active === 'chords') { if (ev.shiftKey) { if (anchor == null) anchor = selChord; } else anchor = null; selChord = Math.max(0, selChord - 1); } else selMel = Math.max(0, selMel - 1); renderChordSlots(); renderMelSlots(); updateTransport(); }
    else if (ev.key === 'ArrowRight' && q) { ev.preventDefault(); if (active === 'chords') { if (ev.shiftKey) { if (anchor == null) anchor = selChord; } else anchor = null; selChord = Math.min(chordSlots.length - 1, selChord + 1); } else selMel = Math.min(melSlots.length - 1, selMel + 1); renderChordSlots(); renderMelSlots(); updateTransport(); }
  });

  if (location.protocol === 'file:' || /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname)) {
    $('#qinfo').innerHTML = '<span style="color:var(--bad)">YouTube не играет музыку со страниц, открытых как файл или по IP-адресу. Откройте <a href="http://localhost:8765/songs.html">localhost:8765/songs.html</a>.</span>';
  }
  Y.on('error', code => {
    if (!q) return;
    unavailable.add(q.song.id);
    ET.toast(`Ролик не загрузился (${Y.ERRORS[code] || 'ошибка ' + code}), беру другую песню`);
    ET.api('POST', '/flag', { id: q.song.id, youtube: q.song.youtube, start: q.song.start, task: TASK, reason: 'unavailable', code, title: q.song.title, artist: q.song.artist }).catch(() => {});
    clearTimeout(autoTimer); autoTimer = setTimeout(next, 800);
  });
  next();
  ET.onLeave(() => { clearTimeout(autoTimer); clearTimeout(cadenceTimer); Y.destroy(); });
  Y.create('player').then(() => { if (q) Y.cue(q.song.youtube, q.song.start); });
});
