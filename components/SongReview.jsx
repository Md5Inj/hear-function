'use client';
/* Ручная проверка песен по уровням: админ отвечает вслепую в том же элементе, что и пользователь,
   после проверки ставит вердикт и пишет возражение; его ответ сохраняется вместе с вердиктом. */
import { useEffect, useState, useCallback } from 'react';
import SB from '@/lib/songs-db';
import { useApp } from './AppProvider';
import { toast, getQuery, setQuery } from './ui';
import SongsExercise from './SongsExercise';

export default function SongReview() {
  const { api } = useApp();
  const q0 = getQuery();
  const [kind, setKind] = useState(q0.get('kind') === 'melody' ? 'melody' : 'chords'); const [mode, setMode] = useState(q0.get('mode') === 'minor' ? 'minor' : 'major'); const [level, setLevel] = useState(+q0.get('level') || 1);
  const [songs, setSongs] = useState(null); const [cur, setCurState] = useState(null);
  const setCur = useCallback((s, push = true) => { setCurState(s); setQuery({ song: s ? s.id : null }, push); }, []);
  useEffect(() => { setQuery({ s: 'review', kind, mode, level: kind === 'chords' ? level : null }); }, [kind, mode, level]);
  useEffect(() => { const onPop = () => { const q = getQuery(); const id = q.get('song'); setSongs(ss => { if (ss) { const f = ss.find(x => x.id === id); if (f) setCurState(f); } return ss; }); }; window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  const [result, setResult] = useState(null); const [note, setNote] = useState('');
  const load = useCallback(() => { setSongs(null); setResult(null); api('GET', `/admin/review?kind=${kind}&mode=${mode}&level=${level}`).then(d => { setSongs(d.songs); const want = getQuery().get('song'); setCur(d.songs.find(s => s.id === want) || d.songs.find(s => !s.review) || d.songs[0] || null, false); }).catch(e => toast(e.message)); }, [api, kind, mode, level, setCur]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setResult(null); setNote(cur && cur.review ? cur.review.note || '' : ''); }, [cur]);
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
          {songs && songs.map(s => (
            <button key={s.id} className={'review-item' + (cur && cur.id === s.id ? ' current' : '') + (s.review && s.review.status ? ' ' + s.review.status : '')} onClick={() => setCur(s)}>
              <span className="mark">{s.review && s.review.status === 'ok' ? '✓' : s.review && s.review.status === 'bad' ? '✕' : '·'}</span>
              <span className="t">{s.title}<small>{s.artist} · {s.section || ''}</small></span>
            </button>
          ))}
          {songs && !songs.length && <p className="muted">На этом уровне песен нет.</p>}
        </div>
        <div className="review-panel">
          {cur && <div className="review-exercise"><SongsExercise key={cur.id} task={kind === 'melody' ? 'melody' : 'chords'} mode={mode} review={{ song: cur, vocab: 'all', onResult: setResult, onNext: next }} /></div>}
          {cur && (
            <div className="review-form">
              {!result && <p className="muted">Ответьте на слух и нажмите «Проверить», затем поставьте вердикт.</p>}
              {result && <p className={result.correct ? 'auth-ok' : 'auth-err'}>{result.correct ? 'Ваш ответ совпал с разметкой.' : `Расходится: вы ${result.answer.map(x => x || '?').join(' – ')}, разметка ${result.truth.join(' – ')}.`}</p>}
              <div className="actions">
                <button className={'btn' + (status === 'ok' ? ' primary' : ' quiet')} disabled={!result} onClick={() => save('ok')}>✓ Разметка верна</button>
                <button className={'btn' + (status === 'bad' ? ' danger' : ' quiet')} disabled={!result} onClick={() => save('bad')}>✕ Разметка неверна</button>
              </div>
              <textarea className="review-note" placeholder="Возражение: что на самом деле звучит, где ошибка в тактах, тональности, темпе…" value={note} onChange={e => setNote(e.target.value)} rows={3} />
              <div className="actions"><button className="btn quiet mini" onClick={() => save(status)}>Сохранить возражение</button>{cur.review && <span className="muted">сохранено {new Date(cur.review.at).toLocaleString('ru-RU')}{cur.review.status ? ', ' + (cur.review.status === 'ok' ? 'верно' : 'неверно') : ''}</span>}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
