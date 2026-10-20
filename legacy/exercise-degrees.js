/* Страница «Ступени» */
ET.ready.then(function () {
  'use strict';
  const T = window.Theory, P = window.Progressions, ET = window.ET, $ = ET.$;
  let q = null, answered = false, block = null, lastDegree = null, autoTimer = null, unlocked = false;

  const page = ET.page({ exercise: 'degrees', levels: mode => P.DEGREE_LEVELS[mode], onReset: () => { block = null; next(false); } });
  const session = ET.session(10, 'Вопрос'); ET.settingsPopover();
  ET.onLeave(() => clearTimeout(autoTimer));

  function newQuestion() {
    const lvl = page.levelDef(), mode = page.mode;
    let tonicPc, playCadence = true;
    if (lvl.keyHint === 'block') {
      if (!block || block.remaining <= 0 || block.mode !== mode) block = { tonicPc: Math.floor(Math.random() * 12), remaining: lvl.blockSize, mode };
      else playCadence = false;
      tonicPc = block.tonicPc; block.remaining--;
    } else tonicPc = Math.floor(Math.random() * 12);
    const label = ET.weightedPick(lvl.degrees, l => (1 + 3 * page.errRate(l)) * (l === lastDegree ? 0.35 : 1));
    lastDegree = label;
    const degree = T.degreeByLabel(mode, label);
    const midi = Math.max(48, Math.min(84, T.tonicMidi(tonicPc) + degree.st + 12 * ET.pick(lvl.octaves)));
    return { mode, tonicPc, degree, midi, timbre: page.timbre(lvl), playCadence, cadence: T.voiceLead(T.CADENCE[mode], mode, tonicPc) };
  }

  function play(opts) {
    opts = opts || {}; unlocked = true;
    const e = ET.audio(); let t = e.ctx.currentTime + 0.1;
    if (q.playCadence && !opts.noteOnly) {
      q.cadence.forEach((c, i) => { const d = i === q.cadence.length - 1 ? 1.0 : 0.65; e.playChord(q.timbre, c.notes, t, d); t += d; });
      t += 0.55;
    }
    e.playNote(q.timbre, q.midi, t, 1.4, 0.5);
  }

  function playResolution() {
    const e = ET.audio();
    const scale = T.SCALES[q.mode].slice();
    if (q.mode === 'minor' && q.degree.st === 11) scale[6] = 11;
    const base = q.midi - q.degree.st, st = q.degree.st, path = [q.midi];
    if (st > 0 && st <= 6) {
      let cur = scale.includes(st) ? st : Math.max(...scale.filter(x => x < st));
      while (cur > 0) { path.push(base + cur); cur = Math.max(...scale.filter(x => x < cur)); }
      path.push(base);
    } else if (st > 6) {
      let cur = scale.includes(st) ? st : Math.min(...scale.filter(x => x > st), 12);
      while (cur < 12) { path.push(base + cur); cur = Math.min(...scale.filter(x => x > cur), 12); }
      path.push(base + 12);
    }
    let t = e.ctx.currentTime + 0.05;
    path.forEach((m, i) => { const d = i === path.length - 1 ? 0.9 : 0.38; e.playNote(q.timbre, m, t, d, 0.45); t += d; });
  }

  function render() {
    const lvl = page.levelDef();
    $('#btnNoteOnly').hidden = !q.playCadence;
    const keys = $('#keys'); keys.innerHTML = '';
    const order = T.DEGREES[q.mode].map(d => d.label);
    lvl.degrees.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b)).forEach(label => {
      const b = document.createElement('button');
      b.className = 'key' + (/[♭♯♮]/.test(label) ? ' chrom' : ''); b.textContent = label; b.dataset.label = label;
      b.addEventListener('click', () => answer(label));
      keys.appendChild(b);
    });
  }

  function answer(label) {
    if (!q || answered) return;
    answered = true;
    const correct = label === q.degree.label;
    page.recordConfusion(q.degree.label, label);
    const levelUp = page.recordResult(correct); session.push(correct);
    ET.logAnswer({ exercise: 'degrees', mode: q.mode, level: page.prog().level, correct, answer: label, truth: q.degree.label });
    const fb = $('#feedback');
    fb.className = 'feedback show ' + (correct ? 'ok' : 'bad');
    fb.innerHTML = `<div class="lead"><b>${correct ? 'Верно.' : 'Нет.'}</b> <span class="roman">${q.degree.label}</span>, ${T.NOTE_NAMES[q.midi % 12]} в ${T.keyName(q.mode, q.tonicPc)}. <button class="link" id="btnResolve">разрешение</button></div>`;
    $('#btnResolve').addEventListener('click', playResolution);
    document.querySelectorAll('#keys .key').forEach(b => {
      b.disabled = true;
      if (b.dataset.label === q.degree.label) b.classList.add('correct'); else if (b.dataset.label === label) b.classList.add('wrong');
    });
    $('#nextActions').hidden = false;
    if (!levelUp && ET.store.autoNext) { clearTimeout(autoTimer); autoTimer = setTimeout(next, correct ? 1400 : 3200); }
  }

  function next(autoplay) {
    clearTimeout(autoTimer); session.nextIfDone();
    q = newQuestion(); answered = false; session.render(true);
    $('#feedback').className = 'feedback'; $('#nextActions').hidden = true;
    render();
    if (autoplay !== false && unlocked) play();
  }

  $('#btnPlay').addEventListener('click', () => q && play());
  $('#btnNoteOnly').addEventListener('click', () => q && play({ noteOnly: true }));
  $('#btnNext').addEventListener('click', () => next());
  ET.listen(document, 'keydown', ev => {
    if (/^(SELECT|INPUT)$/.test(ev.target.tagName)) return;
    if (ev.key === 'Enter') { ev.preventDefault(); if (answered) next(); else play(); }
    else if (ev.key === 'r' || ev.key === 'к') { if (q) play(); }
    else if (/^[1-7]$/.test(ev.key) && q && !answered) {
      const diat = page.mode === 'major' ? ['1', '2', '3', '4', '5', '6', '7'] : ['1', '2', '♭3', '4', '5', '♭6', '♭7'];
      const label = diat[+ev.key - 1];
      if (page.levelDef().degrees.includes(label)) answer(label);
    }
  });
  next(false);
});
