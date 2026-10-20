/* Страница «История»: пройденные песни по ладу и уровню */
ET.ready.then(function () {
  'use strict';
  const $ = ET.$, P = window.Progressions; let ex = 'songs', items = [], answers = {};
  const isSong = () => ex === 'songs' || ex === 'melodies';
  const NOTES = { songs: 'Песни, которые вы уже проходили. Они не показываются повторно, пока не убраны из истории: по одной крестиком или целиком кнопками выше.', melodies: 'Песни, которые вы уже проходили. Они не показываются повторно, пока не убраны из истории: по одной крестиком или целиком кнопками выше.', degrees: 'Ваши ответы в упражнении «Ступени»: по ладу и уровню, последние сверху.', progressions: 'Ваши ответы в упражнении «Прогрессии»: по ладу и уровню, последние сверху.' };
  const exLevelTitle = (mode, level) => { const L = ex === 'degrees' ? P.DEGREE_LEVELS : P.PROG_LEVELS; const l = L && L[mode] && L[mode][level - 1]; return l ? `Уровень ${level}: ${l.title}` : 'Без уровня'; };
  const fmtAns = a => Array.isArray(a) ? a.map(x => x == null || x === '' ? '?' : x).join(' – ') : (a == null ? '' : String(a));
  const fmt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const levelTitle = (mode, level) => { const l = Songs.SONG_LEVELS[mode] && Songs.SONG_LEVELS[mode][level - 1]; return l ? `Уровень ${level}: ${l.title}` : 'Без уровня'; };
  async function load() {
    if (isSong()) items = (await ET.api('GET', '/seen')).seen;
    else answers[ex] = (await ET.api('GET', '/answers?exercise=' + ex)).answers;
    render();
  }
  function renderAnswers() {
    const el = $('#histList'); el.innerHTML = '';
    const list = answers[ex] || [];
    if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="lead">Пока нет ответов.</div></div>'; return; }
    const groups = new Map();
    list.forEach(i => { const key = `${i.mode === 'major' ? 'Мажор' : 'Минор'} · ${exLevelTitle(i.mode, i.level)}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i); });
    [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru', { numeric: true })).forEach(([title, rows]) => {
      const h = document.createElement('div'); h.className = 'hist-group';
      const right = rows.filter(r => r.correct).length;
      h.innerHTML = `<span>${title}</span><span class="hist-group-stat">верно ${right} из ${rows.length}</span>`;
      el.appendChild(h);
      rows.forEach(i => {
        const row = document.createElement('div'); row.className = 'hist-row answers';
        row.innerHTML = `<span class="hist-res ${i.correct ? 'y' : 'n'}">${i.correct ? '✓' : '✕'}</span><span class="hist-title">${fmtAns(i.truth)}</span><span class="hist-artist">${i.correct ? '' : 'ваш вариант: ' + fmtAns(i.answer)}</span><span class="hist-date">${fmt(i.at)}</span><button class="link hist-del" data-tip="Убрать из истории">×</button>`;
        row.querySelector('.hist-del').addEventListener('click', async () => { await ET.api('DELETE', '/answers/' + encodeURIComponent(i.id)); answers[ex] = answers[ex].filter(x => x.id !== i.id); render(); });
        el.appendChild(row);
      });
    });
  }
  function render() {
    $('#histNote').textContent = NOTES[ex];
    if (!isSong()) return renderAnswers();
    const el = $('#histList'); el.innerHTML = '';
    const list = items.filter(i => i.exercise === ex);
    if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="lead">Пока ничего не пройдено.</div></div>'; return; }
    // группы: лад, затем уровень (на мелодиях уровня нет)
    const groups = new Map();
    list.forEach(i => {
      const key = ex === 'melodies' ? (i.mode === 'major' ? 'Мажор' : 'Минор') : `${i.mode === 'major' ? 'Мажор' : 'Минор'} · ${levelTitle(i.mode, i.level)}`;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i);
    });
    [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru', { numeric: true })).forEach(([title, rows]) => {
      const h = document.createElement('div'); h.className = 'hist-group';
      const right = rows.filter(r => r.correct).length;
      h.innerHTML = `<span>${title}</span><span class="hist-group-stat">верно ${right} из ${rows.length}</span>`;
      el.appendChild(h);
      rows.forEach(i => {
        const row = document.createElement('div'); row.className = 'hist-row';
        row.innerHTML = `<span class="hist-res ${i.correct ? 'y' : 'n'}">${i.correct ? '✓' : '✕'}</span><span class="hist-title">${i.title || i.songId}</span><span class="hist-artist">${i.artist || ''}</span><span class="hist-date">${fmt(i.at)}</span><a class="btn quiet mini" href="${ex === 'melodies' ? 'melodies.html' : 'songs.html'}?song=${encodeURIComponent(i.songId)}">Пройти ещё раз</a><button class="link hist-del" data-tip="Убрать из истории">×</button>`;
        row.querySelector('.hist-del').addEventListener('click', async () => { await ET.api('DELETE', '/seen/' + encodeURIComponent(i.id)); ET.store.seen.delete(i.songId); items = items.filter(x => x.id !== i.id); render(); });
        el.appendChild(row);
      });
    });
  }
  document.querySelectorAll('#histFilter button').forEach(b => b.addEventListener('click', () => { ex = b.dataset.ex; document.querySelectorAll('#histFilter button').forEach(x => x.classList.toggle('active', x === b)); if (!isSong() && !answers[ex]) load(); else render(); }));
  $('#btnClearEx').addEventListener('click', async ev => { if (!await ET.confirmPop(ev.currentTarget, 'Очистить историю этого раздела?')) return; await ET.api('DELETE', isSong() ? '/seen?exercise=' + ex : '/answers?exercise=' + ex); await load(); });
  $('#btnClearAll').addEventListener('click', async ev => { if (!await ET.confirmPop(ev.currentTarget, 'Очистить всю историю?')) return; await ET.api('DELETE', '/seen'); await ET.api('DELETE', '/answers'); answers = {}; await load(); });
  load();
});
