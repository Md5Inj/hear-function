'use client';
/* Ручная проверка песен по уровням: админ отвечает вслепую в том же элементе, что и пользователь,
   после проверки ставит вердикт и пишет возражение; его ответ сохраняется вместе с вердиктом. */
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import SB from '@/lib/songs-db';
import { sectionEn } from '@/lib/sections';
import { useApp } from './AppProvider';
import { toast, getQuery, setQuery } from './ui';
import SongsExercise from './SongsExercise';
import GridTimeline from './GridTimeline';
import BarEditor, { toBars, fromBars, barOps } from './BarEditor';

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
  /* редактор тактов: ступени, начало и длина каждого такта; применяется к упражнению на лету, сохраняется кнопкой */
  const [bars, setBars] = useState(null); const [editorOpen, setEditorOpen] = useState(false); const [precise, setPrecise] = useState(false);  // таблица тактов показывает ступени, поэтому до ответа скрыта
  useEffect(() => { setBars(cur ? toBars(cur) : null); setEditorOpen(false); }, [cur && cur.id]);
  const closeEditor = () => { setBars(toBars(cur)); setEditorOpen(false); };  // закрыть без сохранения — вернуть такты // eslint-disable-line react-hooks/exhaustive-deps
  const gridChanged = cur && bars && JSON.stringify(bars) !== JSON.stringify(toBars(cur));
  async function saveGrid() {
    if (!cur || !bars) return;
    const doc = fromBars(cur, bars); delete doc.review;
    try { const d = await api('PUT', `/admin/${kind === 'melody' ? 'melodySongs' : 'chordSongs'}/${encodeURIComponent(cur.id)}`, { doc }); const upd = Object.assign({}, cur, d.doc); setSongs(ss => ss.map(s => s.id === cur.id ? upd : s)); setCurState(upd); toast('Bars saved' + (doc.level !== cur.level ? `, level is now ${doc.level}` : '')); } catch (e) { toast(e.message); }
  }
  const songForExercise = cur && bars ? fromBars(cur, bars) : cur;
  useEffect(() => { setResult(null); setCommentOpen(false); setNote(cur && cur.review ? (cur.review.note || '').split('\n').filter(l => !l.startsWith('My answer')).join('\n').replace(/\n{3,}/g, '\n\n').trim() : ''); }, [cur]);
  useEffect(() => { if (!commentOpen && !editorOpen) return; const onKey = ev => { if (ev.key === 'Escape') { setCommentOpen(false); if (editorOpen) closeEditor(); } }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [commentOpen, editorOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  /* горячие клавиши вердикта (латиница и русская раскладка): Y верна, X неверна, C комментарий, ] следующий, [ назад */
  const keysRef = useRef(null); keysRef.current = { save, next, prev, open: () => setCommentOpen(true), commentOpen };
  useEffect(() => {
    const onKey = ev => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || keysRef.current.commentOpen) return;
      const k = ev.key.toLowerCase(); const f = keysRef.current;
      if (k === 'y' || k === 'н') { ev.preventDefault(); f.save('ok'); }
      else if (k === 'x' || k === 'ч') { ev.preventDefault(); f.save('bad'); }
      else if (k === 'c' || k === 'с') { ev.preventDefault(); f.open(); }
      else if (k === ']' || k === 'ъ') { ev.preventDefault(); f.next(); }
      else if (k === '[' || k === 'х') { ev.preventDefault(); f.prev(); }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);
  async function save(status) {
    if (!cur) return;
    const answerText = result ? `My answer: ${result.answer.map(x => x || '?').join(' – ')}; markup: ${result.truth.join(' – ')}${result.correct ? ' (match)' : ' (differs)'}` : '';
    const text = [answerText, note.trim()].filter(Boolean).join('\n');
    try { const d = await api('POST', '/admin/review/' + encodeURIComponent(cur.id), { kind, status, note: text, answer: result ? result.answer : null, truth: result ? result.truth : null, correct: result ? result.correct : null }); setSongs(ss => ss.map(s => s.id === cur.id ? Object.assign({}, s, { review: d.review }) : s)); toast(status === 'ok' ? 'Marked: correct' : status === 'bad' ? 'Marked: wrong, fragment hidden' : 'Saved'); }
    catch (e) { toast(e.message); }
  }
  function next() { if (!songs || !cur) return; const i = songs.findIndex(s => s.id === cur.id); const after = songs.slice(i + 1).find(s => !s.review) || songs.find(s => !s.review && s.id !== cur.id); if (after) setCur(after); else toast('No more unchecked fragments on this level'); }
  /* назад — просто предыдущая песня в списке, независимо от вердикта */
  function prev() { if (!songs || !cur) return; const i = songs.findIndex(s => s.id === cur.id); if (i > 0) setCur(songs[i - 1]); else toast('This is the first song in the list'); }
  // текущая песня всегда видна в списке
  // мгновенно подводим список к текущей песне до покраски, без плавности — иначе всё скачет
  useLayoutEffect(() => {
    const list = document.querySelector('.review-list'); const el = list && list.querySelector('.review-item.current');
    if (!list || !el) return;
    const lr = list.getBoundingClientRect(), er = el.getBoundingClientRect();
    if (er.top < lr.top || er.bottom > lr.bottom) list.scrollTop += er.top - lr.top - (lr.height - er.height) / 2;
  }, [cur && cur.id, songs]);
  const levels = SB.SONG_LEVELS[mode]; const checked = songs ? songs.filter(s => s.review && s.review.status).length : 0;
  const status = cur && cur.review ? cur.review.status : null;
  return (
    <>
      <h1>Song review</h1>
      <div className="admin-filters">
        <select value={kind} onChange={e => setKind(e.target.value)}><option value="chords">Chords</option><option value="melody">Melodies</option></select>
        <select value={mode} onChange={e => { setMode(e.target.value); setLevel(1); }}><option value="major">Major</option><option value="minor">Minor</option></select>
        {kind === 'chords' && <select value={level} onChange={e => setLevel(+e.target.value)}>{levels.map((l, i) => <option key={i} value={i + 1}>{i + 1}. {l.title}</option>)}</select>}
        {songs ? <span className="muted">{songs.length} fragments, checked {checked}</span> : <span className="skel skel-count" aria-label="Loading" />}
      </div>
      <div className="review">
        <div className="review-list">
          {!songs && Array.from({ length: 12 }, (_, i) => <div key={i} className="review-item skel-item"><span className="skel skel-line" /></div>)}
          {songs && songs.filter(s => !(s.review && s.review.status === 'bad')).map(s => (
            <button key={s.id} className={'review-item' + (cur && cur.id === s.id ? ' current' : '') + (s.review && s.review.status ? ' ' + s.review.status : '')} onClick={() => setCur(s)}>
              <span className="mark">{s.review && s.review.status === 'ok' ? '✓' : '·'}</span>
              <span className="t">{s.title}<small>{s.artist} · {sectionEn(s.section) || ''}</small></span>
            </button>
          ))}
          {songs && !songs.length && <p className="muted">No songs on this level.</p>}
          {songs && songs.some(s => s.review && s.review.status === 'bad') && (
            <details className="review-hidden">
              <summary>Hidden ({songs.filter(s => s.review && s.review.status === 'bad').length})</summary>
              {songs.filter(s => s.review && s.review.status === 'bad').map(s => (
                <button key={s.id} className={'review-item bad' + (cur && cur.id === s.id ? ' current' : '')} onClick={() => setCur(s)}>
                  <span className="mark">✕</span>
                  <span className="t">{s.title}<small>{s.artist} · {sectionEn(s.section) || ''}</small></span>
                </button>
              ))}
            </details>
          )}
        </div>
        <div className="review-panel">
          {cur && (
            <div className="review-bar">
              <button className={'btn ok' + (status === 'ok' ? ' on' : '')} data-tip="(Y)" onClick={() => save('ok')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg><span>Correct</span></button>
              <button className={'btn bad' + (status === 'bad' ? ' on' : '')} data-tip="fragment gets hidden (X)" onClick={() => save('bad')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg><span>Wrong</span></button>
              {status === 'bad' && <button className="btn quiet icon" data-tip="Clear the verdict and return the fragment to the exercise" aria-label="Return to corpus" onClick={() => save(null)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg></button>}
              <button className={'btn note icon' + (note.trim() ? ' on' : '')} data-tip={note.trim() ? "Edit comment (C)" : "Add comment (C)"} aria-label="Comment" onClick={() => setCommentOpen(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>{note.trim() && <span className="dot" />}</button>
              {cur && bars && <button className="btn quiet icon" data-tip="Edit bars and degrees" aria-label="Edit" onClick={() => setEditorOpen(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg></button>}              <span className="nav-group">
              <button className="btn next icon" data-tip="Previous song in the list ( [ )" aria-label="Back" onClick={prev}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button>
              <button className="btn next icon" data-tip="Next unchecked fragment ( ] )" aria-label="Next" onClick={next}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
              </span>
            </div>
          )}
          {editorOpen && cur && bars && (
            <div className="auth-overlay" onClick={ev => { if (ev.target === ev.currentTarget) closeEditor(); }}>
              <div className="auth-box bar-modal">
                <button className="modal-close" type="button" aria-label="Close" onClick={closeEditor}>×</button>
                <div className="auth-title">{cur.artist} — {cur.title}<small className="muted"> · {sectionEn(cur.section)}</small></div>
                <GridTimeline song={cur} bars={bars} setBars={setBars} editable {...(() => { const o = barOps(cur, bars, setBars); return { vocab: o.vocab, onChord: o.setC, onAdd: o.add, onDel: o.del, onSplit: o.split, onTwin: o.twin }; })()} />
                {precise && <BarEditor song={cur} bars={bars} setBars={setBars} />}
                <div className="auth-actions">
                  <button className="btn primary" disabled={!gridChanged} onClick={async () => { await saveGrid(); setEditorOpen(false); }}>Save bars</button>
                  <button className="link" type="button" onClick={closeEditor}>{gridChanged ? 'Discard edits' : 'Close'}</button>
                  <span className="precise-row" style={{ marginLeft: 'auto' }}><button className="link" onClick={() => setPrecise(v => !v)}>{precise ? 'Hide exact values' : 'Exact values'}</button></span>
                </div>
              </div>
            </div>
          )}
          {cur && <div className="review-exercise"><SongsExercise key={cur.id} task={kind === 'melody' ? 'melody' : 'chords'} mode={mode} review={{ song: songForExercise, level, onResult: setResult, onNext: next }} /></div>}
          {commentOpen && (
            <div className="auth-overlay" onClick={ev => { if (ev.target === ev.currentTarget) setCommentOpen(false); }}>
              <div className="auth-box review-comment">
                <button className="modal-close" type="button" aria-label="Close" onClick={() => setCommentOpen(false)}>×</button>
                <div className="auth-title">Comment on the fragment</div>
                <div className="auth-sub">{cur ? `${cur.title} · ${cur.artist}` : ''}</div>
                <textarea className="review-note" autoFocus placeholder="What actually sounds, where the error is in bars, key, tempo…" value={note} onChange={e => setNote(e.target.value)} rows={5} />
                <div className="auth-actions"><button className="btn primary" onClick={async () => { await save(status); setCommentOpen(false); }}>Save</button><button className="link" type="button" onClick={() => setCommentOpen(false)}>Cancel</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
