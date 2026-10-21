'use client';
/* Ручная проверка песен по уровням: админ отвечает вслепую в том же элементе, что и пользователь,
   после проверки ставит вердикт и пишет возражение; его ответ сохраняется вместе с вердиктом. */
import { useEffect, useRef, useState, useCallback } from 'react';
import SB from '@/lib/songs-db';
import { useApp } from './AppProvider';
import { toast, getQuery, setQuery } from './ui';
import SongsExercise from './SongsExercise';
import GridTimeline from './GridTimeline';

export default function SongReview({ initial = {} }) {
  const { api } = useApp();
  const [kind, setKind] = useState(initial.kind === 'melody' ? 'melody' : 'chords'); const [mode, setMode] = useState(initial.mode === 'minor' ? 'minor' : 'major'); const [level, setLevel] = useState(+initial.level || 1);
  const [songs, setSongs] = useState(null); const [cur, setCurState] = useState(null);
  const setCur = useCallback((s, push = true) => { setCurState(s); setQuery({ song: s ? s.id : null }, push); }, []);
  useEffect(() => { setQuery({ s: 'review', kind, mode, level: kind === 'chords' ? level : null }); }, [kind, mode, level]);
  useEffect(() => { const onPop = () => { const q = getQuery(); const id = q.get('song'); setSongs(ss => { if (ss) { const f = ss.find(x => x.id === id); if (f) setCurState(f); } return ss; }); }; window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  const [result, setResult] = useState(null); const [note, setNote] = useState(''); const [commentOpen, setCommentOpen] = useState(false);
  const load = useCallback(() => { setSongs(null); setResult(null); api('GET', `/admin/review?kind=${kind}&mode=${mode}&level=${level}`).then(d => { setSongs(d.songs); const want = getQuery().get('song'); setCur(d.songs.find(s => s.id === want) || d.songs.find(s => !s.review) || d.songs[0] || null, false); }).catch(e => toast(e.message)); }, [api, kind, mode, level, setCur]);
  useEffect(() => { load(); }, [load]);
  /* правка сетки: начало и темп фрагмента; применяется к текущей записи на лету, сохраняется кнопкой */
  const [grid, setGrid] = useState(null);
  useEffect(() => { setGrid(cur ? { start: cur.start, bpm: cur.bpm } : null); }, [cur && cur.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const gridChanged = cur && grid && (grid.start !== cur.start || grid.bpm !== cur.bpm);
  async function saveGrid() {
    if (!cur || !grid) return;
    const doc = Object.assign({}, cur, { start: grid.start, bpm: grid.bpm }); delete doc.review;
    try { const d = await api('PUT', `/admin/${kind === 'melody' ? 'melodySongs' : 'chordSongs'}/${encodeURIComponent(cur.id)}`, { doc }); const upd = Object.assign({}, cur, d.doc); setSongs(ss => ss.map(s => s.id === cur.id ? upd : s)); setCurState(upd); toast('Сетка сохранена'); } catch (e) { toast(e.message); }
  }
  const songForExercise = cur && grid ? Object.assign({}, cur, { start: grid.start, bpm: grid.bpm }) : cur;
  useEffect(() => { setResult(null); setCommentOpen(false); setNote(cur && cur.review ? (cur.review.note || '').split('\n').filter(l => !l.startsWith('Мой ответ')).join('\n') : ''); }, [cur]);
  useEffect(() => { if (!commentOpen) return; const onKey = ev => { if (ev.key === 'Escape') setCommentOpen(false); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [commentOpen]);
  /* горячие клавиши вердикта (латиница и русская раскладка): Y верна, X неверна, C комментарий, ] следующий */
  const keysRef = useRef(null); keysRef.current = { save, next, open: () => setCommentOpen(true), commentOpen };
  useEffect(() => {
    const onKey = ev => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || keysRef.current.commentOpen) return;
      const k = ev.key.toLowerCase(); const f = keysRef.current;
      if (k === 'y' || k === 'н') { ev.preventDefault(); f.save('ok'); }
      else if (k === 'x' || k === 'ч') { ev.preventDefault(); f.save('bad'); }
      else if (k === 'c' || k === 'с') { ev.preventDefault(); f.open(); }
      else if (k === ']' || k === 'ъ') { ev.preventDefault(); f.next(); }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);
  async function save(status) {
    if (!cur) return;
    const answerText = result ? `Мой ответ: ${result.answer.map(x => x || '?').join(' – ')}; в разметке: ${result.truth.join(' – ')}${result.correct ? ' (совпало)' : ' (расходится)'}` : '';
    const text = [answerText, note.trim()].filter(Boolean).join('\n');
    try { const d = await api('POST', '/admin/review/' + encodeURIComponent(cur.id), { kind, status, note: text, answer: result ? result.answer : null, truth: result ? result.truth : null, correct: result ? result.correct : null }); setSongs(ss => ss.map(s => s.id === cur.id ? Object.assign({}, s, { review: d.review }) : s)); toast(status === 'ok' ? 'Отмечено: верно' : status === 'bad' ? 'Отмечено: неверно, фрагмент скрыт' : 'Сохранено'); }
    catch (e) { toast(e.message); }
  }
  function next() { if (!songs || !cur) return; const i = songs.findIndex(s => s.id === cur.id); const after = songs.slice(i + 1).find(s => !s.review) || songs.find(s => !s.review && s.id !== cur.id); if (after) setCur(after); else toast('Непроверенных на этом уровне больше нет'); }
  const levels = SB.SONG_LEVELS[mode]; const checked = songs ? songs.filter(s => s.review && s.review.status).length : 0;
  const status = cur && cur.review ? cur.review.status : null;
  return (
    <>
      <h1>Проверка песен</h1>
      <div className="admin-filters">
        <select value={kind} onChange={e => setKind(e.target.value)}><option value="chords">Аккорды</option><option value="melody">Мелодии</option></select>
        <select value={mode} onChange={e => { setMode(e.target.value); setLevel(1); }}><option value="major">Мажор</option><option value="minor">Минор</option></select>
        {kind === 'chords' && <select value={level} onChange={e => setLevel(+e.target.value)}>{levels.map((l, i) => <option key={i} value={i + 1}>{i + 1}. {l.title}</option>)}</select>}
        <span className="muted">{songs ? `${songs.length} фрагментов, проверено ${checked}` : 'Загрузка…'}</span>
      </div>
      <div className="review">
        <div className="review-list">
          {songs && songs.filter(s => !(s.review && s.review.status === 'bad')).map(s => (
            <button key={s.id} className={'review-item' + (cur && cur.id === s.id ? ' current' : '') + (s.review && s.review.status ? ' ' + s.review.status : '')} onClick={() => setCur(s)}>
              <span className="mark">{s.review && s.review.status === 'ok' ? '✓' : '·'}</span>
              <span className="t">{s.title}<small>{s.artist} · {s.section || ''}</small></span>
            </button>
          ))}
          {songs && !songs.length && <p className="muted">На этом уровне песен нет.</p>}
          {songs && songs.some(s => s.review && s.review.status === 'bad') && (
            <details className="review-hidden">
              <summary>Скрытые ({songs.filter(s => s.review && s.review.status === 'bad').length})</summary>
              {songs.filter(s => s.review && s.review.status === 'bad').map(s => (
                <button key={s.id} className={'review-item bad' + (cur && cur.id === s.id ? ' current' : '')} onClick={() => setCur(s)}>
                  <span className="mark">✕</span>
                  <span className="t">{s.title}<small>{s.artist} · {s.section || ''}</small></span>
                </button>
              ))}
            </details>
          )}
        </div>
        <div className="review-panel">
          {cur && (
            <div className="review-bar">
              <button className={'btn ok' + (status === 'ok' ? ' on' : '')} data-tip="Разметка верна (Y)" onClick={() => save('ok')}>✓ Разметка верна</button>
              <button className={'btn bad' + (status === 'bad' ? ' on' : '')} data-tip="Разметка неверна, фрагмент скрывается (X)" onClick={() => save('bad')}>✕ Разметка неверна</button>
              {status === 'bad' && <button className="btn quiet" data-tip="Снять вердикт и вернуть фрагмент в упражнение" onClick={() => save(null)}>Вернуть в корпус</button>}
              <button className={'btn note' + (note.trim() ? ' on' : '')} data-tip="Комментарий к фрагменту (C)" onClick={() => setCommentOpen(true)}>{note.trim() ? 'Комментарий ✎' : 'Добавить комментарий'}</button>
              <button className="btn next" data-tip="Следующий непроверенный фрагмент ( ] )" onClick={next}>Следующий →</button>
              {(result || (cur.review && cur.review.status)) && <span className="review-status muted">
                {result ? (result.correct ? 'ответ совпал с разметкой' : `расходится: вы ${result.answer.map(x => x || '?').join(' – ')}, разметка ${result.truth.join(' – ')}`) : ''}
                {cur.review && cur.review.status ? `${result ? ' · ' : ''}вердикт: ${cur.review.status === 'ok' ? 'верно' : 'неверно'}` : ''}
              </span>}
            </div>
          )}
          {cur && grid && (
            <div className="review-grid">
              <GridTimeline song={cur} grid={grid} setGrid={setGrid} />
              {gridChanged && <div className="actions"><button className="btn primary mini" onClick={saveGrid}>Сохранить сетку</button><button className="btn quiet mini" onClick={() => setGrid({ start: cur.start, bpm: cur.bpm })}>Отменить</button></div>}
            </div>
          )}
          {cur && <div className="review-exercise"><SongsExercise key={cur.id} task={kind === 'melody' ? 'melody' : 'chords'} mode={mode} review={{ song: songForExercise, level, onResult: setResult, onNext: next }} /></div>}
          {commentOpen && (
            <div className="auth-overlay" onClick={ev => { if (ev.target === ev.currentTarget) setCommentOpen(false); }}>
              <div className="auth-box review-comment">
                <button className="modal-close" type="button" aria-label="Закрыть" onClick={() => setCommentOpen(false)}>×</button>
                <div className="auth-title">Комментарий к фрагменту</div>
                <div className="auth-sub">{cur ? `${cur.title} · ${cur.artist}` : ''}</div>
                <textarea className="review-note" autoFocus placeholder="Что на самом деле звучит, где ошибка в тактах, тональности, темпе…" value={note} onChange={e => setNote(e.target.value)} rows={5} />
                <div className="auth-actions"><button className="btn primary" onClick={async () => { await save(status); setCommentOpen(false); }}>Сохранить</button><button className="link" type="button" onClick={() => setCommentOpen(false)}>Отмена</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
