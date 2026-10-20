/* Редактор разметки песен: первая доля + темп + такты. */
ET.ready.then(function () {
  'use strict';
  const T = window.Theory, SB = window.Songs, ET = window.ET, $ = ET.$, Y = window.YTP;
  const blank = () => ({ id: '', title: '', artist: '', youtube: '', key: { tonic: 0, mode: 'major' }, level: 1, draft: false, section: '', start: 0, bpm: 120, beatsPerBar: 4, chords: [], melody: null });
  let song = blank(), inversion = 0, taps = [];
  const r2 = x => Math.round(x * 20) / 20;
  const now = () => r2(Y.time());
  const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  const ex = () => SB.expand(song);

  // ---------- форма ----------
  function toForm() {
    $('#fTitle').value = song.title; $('#fArtist').value = song.artist; $('#fYoutube').value = song.youtube;
    $('#fTonic').value = song.key.tonic; $('#fMode').value = song.key.mode; $('#fLevel').value = song.level;
    $('#fSection').value = song.section || ''; $('#fDraft').checked = !!song.draft; $('#fId').value = song.id;
    $('#fStart').value = song.start; $('#fBpm').value = song.bpm; $('#fBpb').value = song.beatsPerBar || 4;
    $('#mLyric').value = song.melody ? song.melody.lyric || '' : '';
    $('#mStart').value = song.melody ? song.melody.start : ''; $('#mEnd').value = song.melody ? song.melody.end : '';
    renderPicker(); renderChords(); renderMelody(); updateJson();
  }
  function fromForm() {
    song.title = $('#fTitle').value.trim(); song.artist = $('#fArtist').value.trim();
    song.youtube = Y.parseId($('#fYoutube').value) || $('#fYoutube').value.trim();
    song.key.tonic = +$('#fTonic').value; song.key.mode = $('#fMode').value; song.level = +$('#fLevel').value;
    song.section = $('#fSection').value.trim(); song.draft = $('#fDraft').checked;
    song.id = $('#fId').value.trim() || slug(song.title + ' ' + song.section);
    song.start = +$('#fStart').value || 0; song.bpm = +$('#fBpm').value || 120; song.beatsPerBar = +$('#fBpb').value || 4;
    const lyric = $('#mLyric').value.trim(), ms = $('#mStart').value, me = $('#mEnd').value;
    const degrees = song.melody ? song.melody.degrees : [];
    song.melody = (degrees.length || lyric || ms) ? { lyric, start: +ms || 0, end: +me || 0, degrees } : null;
    renderChords(); updateJson();
  }
  function slug(s) {
    const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ь: '', ъ: '' };
    return s.toLowerCase().split('').map(c => map[c] != null ? map[c] : c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'song';
  }
  function updateJson() {
    const out = { id: song.id, title: song.title, artist: song.artist, youtube: song.youtube, key: song.key, level: song.level };
    if (song.draft) out.draft = true;
    out.start = song.start; out.bpm = song.bpm; if (song.beatsPerBar !== 4) out.beatsPerBar = song.beatsPerBar;
    out.chords = song.chords.map(c => c.beats === song.beatsPerBar ? { c: c.c } : { c: c.c, beats: c.beats });
    if (song.section) out.section = song.section;
    if (song.melody && song.melody.degrees.length) out.melody = song.melody;
    $('#json').value = JSON.stringify(out, null, 2);
    const e = ex();
    $('#fEndInfo').textContent = song.chords.length ? `Фрагмент ${fmt(song.start)}–${fmt(e.end)}, ${song.chords.length} аккордов.` : '';
    $('#jsonNote').textContent = validate().join(' ') || 'Разметка выглядит корректно.';
  }
  function validate() {
    const e = [];
    if (!song.youtube || !/^[\w-]{11}$/.test(song.youtube)) e.push('Нет корректного ID видео.');
    if (!song.title) e.push('Нет названия.');
    if (!(song.bpm > 30 && song.bpm < 300)) e.push('Темп вне разумных границ.');
    if (!song.chords.length) e.push('Нет ни одного аккорда.');
    if (song.melody && song.melody.degrees.length && !(song.melody.end > song.melody.start)) e.push('У фразы мелодии не задано начало и конец.');
    return e;
  }

  // ---------- аккорды ----------
  function renderPicker() {
    const el = $('#picker'); el.innerHTML = '';
    const mode = $('#fMode').value;
    const groups = { 0: [], 1: [], 2: [] }, names = { 0: 'Трезвучия', 1: 'Септаккорды', 2: 'Хроматика' };
    Object.keys(T.CHORDS[mode]).forEach(sym => {
      const chrom = /\//.test(sym) || /^♭/.test(sym) || sym === 'N' || (mode === 'minor' && sym === 'I') || (mode === 'major' && (sym === 'iv' || sym === 'ii°')) || sym === 'vii°7';
      groups[chrom ? 2 : /7|ø|sus/.test(sym) ? 1 : 0].push(sym);
    });
    [0, 1, 2].forEach(g => {
      const row = document.createElement('div'); row.className = 'vocab-group';
      const l = document.createElement('span'); l.className = 'lbl'; l.textContent = names[g]; row.appendChild(l);
      groups[g].forEach(sym => { const b = document.createElement('button'); b.className = 'chord'; b.textContent = sym; b.addEventListener('click', () => addChord(sym)); row.appendChild(b); });
      el.appendChild(row);
    });
  }
  function addChord(sym) {
    const tok = inversion ? sym + ':' + inversion : sym;
    try { T.chordDef($('#fMode').value, tok); } catch (e) { ET.toast('Нет такого обращения для этого аккорда'); return; }
    song.chords.push({ c: tok, beats: +$('#fBeats').value || song.beatsPerBar });
    fromForm();
  }
  function renderChords() {
    const e = ex();
    const list = $('#chordList'); list.innerHTML = '';
    e.chords.forEach((c, i) => {
      const next = i + 1 < e.chords.length ? e.chords[i + 1].t : e.end;
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span class="sym">${T.displayToken(c.c)}</span><label class="inline">долей <input type="number" step="1" min="1" value="${song.chords[i].beats}"></label><span class="muted">${c.t.toFixed(2)} с</span><button class="btn quiet mini">▶</button><button class="btn quiet mini">удалить</button>`;
      const [inp, bPlay, bDel] = row.querySelectorAll('input,button');
      inp.addEventListener('change', () => { song.chords[i].beats = Math.max(1, +inp.value || 1); fromForm(); });
      bPlay.addEventListener('click', () => Y.playRange(song.youtube, c.t, next));
      bDel.addEventListener('click', () => { song.chords.splice(i, 1); fromForm(); });
      list.appendChild(row);
    });
    const sheet = $('#edSheet'); sheet.innerHTML = '';
    e.chords.forEach((c, i) => {
      const next = i + 1 < e.chords.length ? e.chords[i + 1].t : e.end;
      const s = document.createElement('button'); s.className = 'slot'; s.style.flexGrow = ((next - c.t) / (e.end - e.start) * 100).toFixed(3);
      s.innerHTML = `<span>${T.displayToken(c.c)}</span>`;
      s.addEventListener('click', () => Y.playRange(song.youtube, c.t, next));
      sheet.appendChild(s);
    });
    const ph = document.createElement('div'); ph.id = 'playhead'; ph.hidden = true; sheet.appendChild(ph);
  }
  setInterval(() => {
    const e = ex(); if (!e.chords.length) return;
    const t = Y.state() === 1 ? Y.time() : -1;
    document.querySelectorAll('#edSheet .slot').forEach((el, i) => { const a = e.chords[i].t, b = i + 1 < e.chords.length ? e.chords[i + 1].t : e.end; el.classList.toggle('playing', t >= a && t < b); });
    const ph = $('#playhead'); if (!ph) return;
    const inside = t >= e.start && t <= e.end; ph.hidden = !inside;
    if (inside) ph.style.left = ((t - e.start) / (e.end - e.start) * 100).toFixed(2) + '%';
  }, 60);

  function tap() {
    const t = performance.now();
    if (taps.length && t - taps[taps.length - 1] > 2500) taps = [];
    taps.push(t);
    if (taps.length >= 3) {
      const iv = []; for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
      iv.sort((a, b) => a - b);
      const med = iv[Math.floor(iv.length / 2)];
      $('#fBpm').value = (60000 / med).toFixed(1); fromForm();
    }
    $('#tapInfo').textContent = taps.length < 3 ? `${taps.length}…` : `${$('#fBpm').value} BPM по ${taps.length} нажатиям`;
  }

  // ---------- мелодия ----------
  function renderMelody() {
    const el = $('#melKeys'); el.innerHTML = '';
    T.DEGREES[$('#fMode').value].forEach(d => {
      const b = document.createElement('button'); b.className = 'key small' + (/[♭♯♮]/.test(d.label) ? ' chrom' : ''); b.textContent = d.label;
      b.addEventListener('click', () => { if (!song.melody) song.melody = { lyric: '', start: 0, end: 0, degrees: [] }; song.melody.degrees.push(d.label); renderMelody(); fromForm(); });
      el.appendChild(b);
    });
    $('#degList').textContent = song.melody && song.melody.degrees.length ? song.melody.degrees.join('  ') : '';
  }

  // ---------- сохранение ----------
  let customList = [];
  async function saveLocal() {
    fromForm();
    const errs = validate(); if (errs.length) { ET.toast(errs[0]); return; }
    const copy = JSON.parse($('#json').value);
    try { await ET.api('POST', '/custom-song', { song: copy }); await ET.loadSongs(); await renderSaved(); ET.toast('Сохранено в вашем аккаунте'); }
    catch (e) { ET.toast('Не удалось сохранить: ' + e.message); }
  }
  async function renderSaved() {
    const el = $('#savedList'); el.innerHTML = '';
    try { customList = (await ET.api('GET', '/custom-songs')).songs; } catch (e) { customList = []; }
    if (!customList.length) { el.innerHTML = '<span class="empty">Пока ничего не сохранено.</span>'; return; }
    customList.forEach(s => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${s.artist} — ${s.title}${s.section ? ' (' + s.section + ')' : ''}, ${s.key.mode === 'major' ? 'мажор' : 'минор'}, уровень ${s.level}</span><button class="link">открыть</button><button class="link">удалить</button>`;
      const [bOpen, bDel] = row.querySelectorAll('button');
      bOpen.addEventListener('click', () => loadSong(s));
      bDel.addEventListener('click', async () => { if (!confirm('Удалить «' + s.title + '» из сохранённых?')) return; await ET.api('DELETE', '/custom-song/' + encodeURIComponent(s.id)); await ET.loadSongs(); renderSaved(); });
      el.appendChild(row);
    });
  }
  function loadSong(src) {
    const s = JSON.parse(JSON.stringify(src));
    song = Object.assign(blank(), { id: s.id, title: s.title, artist: s.artist, youtube: s.youtube, key: s.key, level: s.level, draft: !!s.draft, section: s.section || '', start: s.start, bpm: s.bpm || 120, beatsPerBar: s.beatsPerBar || 4, chords: [], melody: s.melody || null });
    if (s.chords.length && s.chords[0].t != null) { // старый формат с абсолютными временами
      const bar = (s.end - s.start) / s.chords.length; song.bpm = +(60 * 4 / bar).toFixed(1);
      song.chords = s.chords.map((c, i) => ({ c: c.c, beats: Math.max(1, Math.round(((i + 1 < s.chords.length ? s.chords[i + 1].t : s.end) - c.t) / (60 / song.bpm))) }));
    } else song.chords = s.chords.map(c => ({ c: c.c, beats: c.beats != null ? c.beats : song.beatsPerBar }));
    toForm();
    if (Y.ready) Y.cue(song.youtube, song.start);
  }

  // ---------- привязка ----------
  ['fTitle', 'fArtist', 'fTonic', 'fMode', 'fLevel', 'fSection', 'fDraft', 'fId', 'fStart', 'fBpm', 'fBpb', 'mLyric', 'mStart', 'mEnd'].forEach(id => $('#' + id).addEventListener('change', () => { fromForm(); if (id === 'fMode') { renderPicker(); renderMelody(); } }));
  $('#fYoutube').addEventListener('change', () => { fromForm(); if (Y.ready && song.youtube) Y.cue(song.youtube, song.start); });
  $('#btnLoad').addEventListener('click', () => { fromForm(); if (!song.youtube) { ET.toast('Вставьте ссылку на YouTube'); return; } Y.playRange(song.youtube, song.start); });
  $('#btnPlayPause').addEventListener('click', () => { if (Y.state() === 1) Y.pause(); else if (Y.currentId === song.youtube) Y.play(); else Y.playRange(song.youtube, song.start); });
  document.querySelectorAll('[data-seek]').forEach(b => b.addEventListener('click', () => Y.seek(Y.time() + +b.dataset.seek)));
  $('#rate').addEventListener('change', e => Y.rate(+e.target.value));
  $('#btnStartNow').addEventListener('click', () => { $('#fStart').value = now(); fromForm(); });
  document.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => { $('#fStart').value = r2(song.start + +b.dataset.start); fromForm(); }));
  document.querySelectorAll('[data-bpm]').forEach(b => b.addEventListener('click', () => { $('#fBpm').value = (song.bpm + +b.dataset.bpm).toFixed(1); fromForm(); }));
  $('#btnTap').addEventListener('click', tap);
  $('#btnPlayFragment').addEventListener('click', () => { fromForm(); const e = ex(); Y.playRange(song.youtube, e.start, e.end); });
  document.querySelectorAll('[data-inv]').forEach(b => b.addEventListener('click', () => { inversion = +b.dataset.inv; document.querySelectorAll('[data-inv]').forEach(x => x.classList.toggle('active', x === b)); }));
  $('#btnClearChords').addEventListener('click', () => { song.chords = []; fromForm(); });
  $('#mStartNow').addEventListener('click', () => { $('#mStart').value = now(); fromForm(); });
  $('#mEndNow').addEventListener('click', () => { $('#mEnd').value = now(); fromForm(); });
  $('#btnPlayPhrase').addEventListener('click', () => { fromForm(); if (song.melody) Y.playRange(song.youtube, song.melody.start, song.melody.end); });
  $('#btnDegUndo').addEventListener('click', () => { if (song.melody) { song.melody.degrees.pop(); renderMelody(); fromForm(); } });
  $('#btnDegClear').addEventListener('click', () => { if (song.melody) { song.melody.degrees = []; renderMelody(); fromForm(); } });
  $('#btnSave').addEventListener('click', saveLocal);
  $('#btnCopy').addEventListener('click', () => { navigator.clipboard.writeText($('#json').value).then(() => ET.toast('JSON скопирован')); });
  $('#btnImport').addEventListener('click', () => { try { loadSong(JSON.parse($('#json').value)); ET.toast('Загружено из JSON'); } catch (e) { ET.toast('Не удалось разобрать JSON'); } });
  $('#btnNew').addEventListener('click', () => loadSong(blank()));
  document.addEventListener('keydown', ev => {
    if (/^(SELECT|INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
    if (ev.key === ' ') { ev.preventDefault(); $('#btnPlayPause').click(); }
    else if (ev.key === 't' || ev.key === 'е') tap();
    else if (ev.key === 'b' || ev.key === 'и') $('#btnStartNow').click();
  });

  T.NOTE_NAMES.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; $('#fTonic').appendChild(o); });
  setInterval(() => { $('#clock').textContent = Y.time().toFixed(2); $('#btnPlayPause').textContent = Y.state() === 1 ? 'Пауза' : 'Играть'; }, 100);
  Y.on('error', code => ET.toast('Видео не воспроизводится: ' + (Y.ERRORS[code] || 'ошибка ' + code)));

  const builtin = $('#builtinList');
  const BUILTIN = ET.store.songs;
  BUILTIN.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = `${s.artist} — ${s.title}${s.section ? ' (' + s.section + ')' : ''}${s.draft ? ' (не откалибрована)' : ''}`; builtin.appendChild(o); });
  builtin.addEventListener('change', () => { const s = BUILTIN.find(x => x.id === builtin.value); if (s) loadSong(s); });

  async function renderBad() {
    const el = $('#badList'); if (!el) return;
    try { const list = (await ET.api('GET', '/flags')).flags; el.innerHTML = list.length ? `Отмечено как неверные: ${list.length}. ` + list.slice(-20).map(f => `${f.artist || ''} — ${f.title || f.songId} (${f.reason})`).join('; ') : 'Отметок нет.'; }
    catch (e) { el.textContent = ''; }
  }
  renderBad();
  renderSaved();
  const wanted = new URLSearchParams(location.search).get('id');
  const found = wanted && BUILTIN.find(s => s.id === wanted);
  if (found) { loadSong(found); builtin.value = found.id; } else toForm();
  Y.create('player').then(() => { if (song.youtube) Y.cue(song.youtube, song.start); });
});
