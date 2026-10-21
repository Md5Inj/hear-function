'use client';
/* Админка: меню слева, разделы — обзор, песни, мелодии, пользователи, отметки, администраторы, настройки, сырые данные. */
import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import Songs from '@/lib/songs-db';
import { useApp } from './AppProvider';
import { confirmPop, toast, getQuery, setQuery } from './ui';
import SongReview from './SongReview';

const SECTIONS = [
  ['overview', 'Обзор'], ['review', 'Проверка песен'], ['chords', 'Аккорды песен'], ['melodies', 'Мелодии песен'], ['users', 'Пользователи'],
  ['flags', 'Отметки'], ['admins', 'Администраторы'], ['settings', 'Настройки'], ['data', 'Данные'],
];
const COLS = ['chordSongs', 'melodySongs', 'reviews', 'users', 'admins', 'state', 'seen', 'answers', 'flags', 'customSongs', 'settings', 'meta'];
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const fmtTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const modeName = m => m === 'major' ? 'мажор' : 'минор';
const fmtVal = v => { if (v == null) return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return s.length > 80 ? s.slice(0, 77) + '…' : s; };

export default function AdminPage({ admin }) {
  const { api, router } = useApp();
  const [section, setSectionState] = useState(() => { const s = getQuery().get('s'); return SECTIONS.some(([k]) => k === s) ? s : 'overview'; });
  const setSection = useCallback(k => { setSectionState(k); setQuery({ s: k, kind: null, mode: null, level: null, song: null }, true); }, []);
  useEffect(() => { const onPop = () => { const s = getQuery().get('s'); setSectionState(SECTIONS.some(([k]) => k === s) ? s : 'overview'); }; window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-side-title">Админка</div>
        <nav className="admin-nav">{SECTIONS.map(([k, label]) => <button key={k} className={section === k ? 'active' : ''} onClick={() => setSection(k)}>{label}</button>)}</nav>
        <div className="admin-side-foot"><span className="muted">{admin ? admin.login : ''}</span><button className="link" onClick={async () => { await api('POST', '/admin/logout'); router.refresh(); }}>Выйти</button></div>
      </aside>
      <main className="admin-main">
        {section === 'overview' && <Overview api={api} go={setSection} />}
        {section === 'review' && <SongReview />}
        {section === 'chords' && <SongList api={api} col="chordSongs" kind="chords" />}
        {section === 'melodies' && <SongList api={api} col="melodySongs" kind="melody" />}
        {section === 'users' && <Users api={api} />}
        {section === 'flags' && <Flags api={api} />}
        {section === 'admins' && <Admins api={api} me={admin} />}
        {section === 'settings' && <Settings api={api} router={router} />}
        {section === 'data' && <RawData api={api} />}
      </main>
    </div>
  );
}

function useLoad(fn, deps) {
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  const reload = useCallback(() => { setErr(''); fn().then(setData).catch(e => setErr(e.message)); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return [data, reload, err];
}

function Overview({ api, go }) {
  const [d, , err] = useLoad(() => api('GET', '/admin/overview'), [api]);
  if (err) return <p className="auth-err">{err}</p>;
  if (!d) return <p className="muted">Загрузка…</p>;
  const min = d.settings.minSongsPerLevel || 20;
  const Levels = ({ mode }) => (
    <div className="admin-levels">
      <h3>{mode === 'major' ? 'Мажор' : 'Минор'}</h3>
      {d.levels[mode].map(l => (
        <div key={l.level} className={'admin-level' + (l.songs < min ? ' low' : '')}>
          <span className="num">{l.level}</span><span className="title">{l.title}</span>
          <span className="bar"><i style={{ width: Math.min(100, l.songs / Math.max(min * 2, 1) * 100) + '%' }} /></span>
          <span className="count">{l.songs}</span>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <h1>Обзор</h1>
      <div className="admin-cards">
        <button className="admin-card" onClick={() => go('users')}><div className="num">{d.users}</div><div className="label">пользователей</div></button>
        <button className="admin-card" onClick={() => go('chords')}><div className="num">{d.chordSongs}</div><div className="label">фрагментов с аккордами</div></button>
        <button className="admin-card" onClick={() => go('melodies')}><div className="num">{d.melodySongs}</div><div className="label">вокальных фраз</div></button>
        <div className="admin-card"><div className="num">{d.answers}</div><div className="label">ответов, за сутки {d.answersToday}</div></div>
        <button className="admin-card" onClick={() => go('flags')}><div className="num">{d.flags}</div><div className="label">отметок</div></button>
        <div className="admin-card"><div className="num small">{d.lastImport ? fmtDate(d.lastImport) : '—'}</div><div className="label">последний импорт корпуса</div></div>
      </div>
      <h2>Песен на уровень <span className="muted">(цель не меньше {min}, красным где меньше)</span></h2>
      <div className="admin-two"><Levels mode="major" /><Levels mode="minor" /></div>
    </>
  );
}

function SongList({ api, col, kind }) {
  const [all, reload, err] = useLoad(() => api('GET', `/admin/${col}?limit=2000`).then(d => d.docs), [api, col]);
  const [q, setQ] = useState(''); const [mode, setMode] = useState('all'); const [level, setLevel] = useState('all'); const [page, setPage] = useState(0);
  const [edit, setEdit] = useState(null); const [draft, setDraft] = useState(''); const [draftErr, setDraftErr] = useState('');
  const PAGE = 30;
  const rows = useMemo(() => (all || []).map(s => { const e = Songs.expand(s); return { raw: s, e, level: Songs.levelFor(e) }; }), [all]);
  const list = rows.filter(r => (mode === 'all' || r.e.key.mode === mode) && (level === 'all' || String(r.level) === level) && (!q || (r.raw.title + ' ' + r.raw.artist + ' ' + r.raw.id).toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const levels = Songs.SONG_LEVELS[mode === 'minor' ? 'minor' : 'major'];
  if (err) return <p className="auth-err">{err}</p>;
  return (
    <>
      <h1>{kind === 'melody' ? 'Мелодии песен' : 'Аккорды песен'} <span className="muted">{all ? all.length : ''}</span></h1>
      <div className="admin-filters">
        <input type="search" placeholder="Название, исполнитель или id" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
        <select value={mode} onChange={e => { setMode(e.target.value); setLevel('all'); setPage(0); }}><option value="all">Оба лада</option><option value="major">Мажор</option><option value="minor">Минор</option></select>
        {kind !== 'melody' && <select value={level} onChange={e => { setLevel(e.target.value); setPage(0); }}><option value="all">Все уровни</option>{levels.map((l, i) => <option key={i} value={i + 1}>{i + 1}. {l.title}</option>)}</select>}
        <span className="muted">{list.length} {list.length === all?.length ? 'всего' : 'найдено'}</span>
      </div>
      {!all && <p className="muted">Загрузка…</p>}
      <div className="admin-songs">
        {list.slice(page * PAGE, page * PAGE + PAGE).map(({ raw: s, e, level: lv }) => (
          <div key={s.id} className={'admin-song' + (edit === s.id ? ' open' : '')}>
            <a className="adm-thumb" href={'https://www.youtube.com/watch?v=' + s.youtube + '&t=' + Math.floor(s.start)} target="_blank" rel="noreferrer" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${s.youtube}/mqdefault.jpg)` }} aria-label="Открыть на YouTube" />
            <div className="adm-info">
              <div className="title">{s.title} <span className="muted">· {s.artist}</span></div>
              <div className="meta">{modeName(e.key.mode)}{lv ? `, уровень ${lv}` : ', вне лестницы'} · {s.section || 'фрагмент'} · {fmtTime(s.start)}–{fmtTime(e.end)} · {Songs.barsOf(s)} такт. · {e.bpm} bpm{s.source === 'hand' ? ' · ручная' : ''}{s.edited ? ' · правлена' : ''}</div>
              <div className="chords">{kind === 'melody' ? s.melody.degrees.join(' ') : s.chords.map(c => c.c).join(' – ')}</div>
            </div>
            <div className="adm-acts">
              <a className="btn quiet mini" href={(kind === 'melody' ? '/melodies' : '/songs') + '?song=' + encodeURIComponent(s.id)} target="_blank" rel="noreferrer">Открыть</a>
              <button className="btn quiet mini" onClick={() => { setEdit(edit === s.id ? null : s.id); setDraft(JSON.stringify(s, null, 2)); setDraftErr(''); }}>{edit === s.id ? 'Свернуть' : 'Править'}</button>
              <button className="link hist-del" data-tip="Удалить" onClick={async ev => { if (!await confirmPop(ev.currentTarget, `Удалить «${s.title}»?`)) return; await api('DELETE', `/admin/${col}/${encodeURIComponent(s.id)}`); toast('Удалено'); reload(); }}>×</button>
            </div>
            {edit === s.id && (
              <div className="editor">
                <textarea className="admin-editor" value={draft} spellCheck={false} rows={Math.min(28, draft.split('\n').length + 1)} onChange={e => setDraft(e.target.value)} />
                <div className="actions admin-editor-actions">
                  <button className="btn primary mini" onClick={async () => { let doc; try { doc = JSON.parse(draft); } catch (x) { setDraftErr('Некорректный JSON: ' + x.message); return; } try { await api('PUT', `/admin/${col}/${encodeURIComponent(s.id)}`, { doc }); toast('Сохранено'); setEdit(null); reload(); } catch (x) { setDraftErr(x.message); } }}>Сохранить</button>
                  <button className="btn quiet mini" onClick={() => setEdit(null)}>Отмена</button><span className="auth-err">{draftErr}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {pages > 1 && <div className="actions admin-pages"><button className="btn quiet mini" disabled={page <= 0} onClick={() => setPage(page - 1)}>← Назад</button><span className="muted">страница {page + 1} из {pages}</span><button className="btn quiet mini" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Вперёд →</button></div>}
    </>
  );
}

function Users({ api }) {
  const [d, reload, err] = useLoad(() => api('GET', '/admin/users'), [api]);
  if (err) return <p className="auth-err">{err}</p>;
  const prog = p => Object.entries(p || {}).filter(([, v]) => v && v.total).map(([k, v]) => { const [ex, mode] = k.split('.'); const names = { degrees: 'ступени', progressions: 'прогрессии', songs: 'аккорды', melodies: 'мелодии' }; return `${names[ex] || ex} ${modeName(mode)}: ур. ${v.level}`; });
  return (
    <>
      <h1>Пользователи <span className="muted">{d ? d.users.length : ''}</span></h1>
      {!d && <p className="muted">Загрузка…</p>}
      <div className="admin-list">
        {d && d.users.map(u => (
          <div key={u.id} className="admin-row">
            <div className="adm-info">
              <div className="title">{u.name} <span className="muted">· {u.email}</span></div>
              <div className="meta">с {fmtDate(u.created)} · ответов {u.answers.total}, верных {u.answers.correct}{u.answers.last ? ` · последний ${fmtDate(u.answers.last)}` : ''}</div>
              {prog(u.progress).length > 0 && <div className="meta">{prog(u.progress).join(' · ')}</div>}
            </div>
            <div className="adm-acts"><button className="link hist-del" data-tip="Удалить пользователя и его данные" onClick={async ev => { if (!await confirmPop(ev.currentTarget, `Удалить ${u.email} со всем прогрессом?`)) return; await api('DELETE', `/admin/users/${encodeURIComponent(u.id)}`); toast('Удалено'); reload(); }}>×</button></div>
          </div>
        ))}
        {d && !d.users.length && <p className="muted">Пока никого.</p>}
      </div>
    </>
  );
}

function Flags({ api }) {
  const [d, reload, err] = useLoad(() => api('GET', '/admin/flags?limit=2000'), [api]);
  if (err) return <p className="auth-err">{err}</p>;
  const reasons = { unavailable: 'ролик не загрузился (устаревшая автоматическая отметка)', wrong: 'разметка неверна' };
  return (
    <>
      <h1>Отметки <span className="muted">{d ? d.total : ''}</span></h1>
      <p className="hist-note">Ручные отметки «разметка неверна» скрывают фрагмент из корпуса для всех (см. настройку). Автоматические отметки плеера ни на что не влияют.</p>
      <div className="admin-list">
        {d && d.docs.map(f => (
          <div key={f.id} className="admin-row">
            <div className="adm-info"><div className="title">{f.title || f.songId} <span className="muted">· {f.artist || ''}</span></div><div className="meta">{reasons[f.reason] || f.reason || 'без причины'} · {f.task || ''} · {fmtDate(f.at)}</div></div>
            <div className="adm-acts"><button className="link hist-del" data-tip="Снять отметку" onClick={async ev => { if (!await confirmPop(ev.currentTarget, 'Снять отметку?')) return; await api('DELETE', `/admin/flags/${encodeURIComponent(f.id)}`); reload(); }}>×</button></div>
          </div>
        ))}
        {d && !d.docs.length && <p className="muted">Отметок нет.</p>}
      </div>
    </>
  );
}

function Admins({ api, me }) {
  const [d, reload, err] = useLoad(() => api('GET', '/admin/admins'), [api]);
  const [formErr, setFormErr] = useState('');
  async function add(ev) {
    ev.preventDefault(); setFormErr(''); const f = ev.currentTarget;
    try { await api('POST', '/admin/admins', { doc: { login: f.login.value.trim(), password: f.password.value, at: new Date().toISOString() } }); f.reset(); toast('Администратор добавлен'); reload(); } catch (e) { setFormErr(e.message); }
  }
  return (
    <>
      <h1>Администраторы</h1>
      {err && <p className="auth-err">{err}</p>}
      <div className="admin-list">
        {d && d.docs.map(a => (
          <div key={a.id} className="admin-row">
            <div className="adm-info"><div className="title">{a.login}{me && me.id === a.id ? <span className="muted"> · это вы</span> : null}</div><div className="meta">с {fmtDate(a.at)}</div></div>
            <div className="adm-acts">{me && me.id !== a.id && <button className="link hist-del" data-tip="Удалить" onClick={async ev => { if (!await confirmPop(ev.currentTarget, `Удалить администратора ${a.login}?`)) return; await api('DELETE', `/admin/admins/${encodeURIComponent(a.id)}`); reload(); }}>×</button>}</div>
          </div>
        ))}
      </div>
      <h2>Добавить администратора</h2>
      <form className="admin-form" onSubmit={add}>
        <label>Логин<input name="login" required autoComplete="off" /></label>
        <label>Пароль<input name="password" type="password" required minLength={6} autoComplete="new-password" /></label>
        <div className="actions"><button className="btn primary" type="submit">Добавить</button><span className="auth-err">{formErr}</span></div>
      </form>
    </>
  );
}

function Settings({ api, router }) {
  const [d, reload, err] = useLoad(() => api('GET', '/admin/settings').then(x => x.settings), [api]);
  const [form, setForm] = useState(null); const [msg, setMsg] = useState('');
  useEffect(() => { if (d) setForm(d); }, [d]);
  if (err) return <p className="auth-err">{err}</p>;
  if (!form) return <p className="muted">Загрузка…</p>;
  const num = (k, label, hint, min, max) => <label className="admin-setting"><span><b>{label}</b><small>{hint}</small></span><input type="number" min={min} max={max} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></label>;
  const bool = (k, label, hint) => <label className="admin-setting check"><input type="checkbox" checked={!!form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} /><span><b>{label}</b><small>{hint}</small></span></label>;
  return (
    <>
      <h1>Настройки</h1>
      <form className="admin-settings" onSubmit={async ev => { ev.preventDefault(); setMsg(''); try { const r = await api('PUT', '/admin/settings', form); setForm(r.settings); setMsg('Сохранено'); toast('Настройки сохранены'); router.refresh(); } catch (e) { setMsg(e.message); } }}>
        <h2>Упражнения</h2>
        {num('sessionLength', 'Вопросов в серии', 'Длина серии в полосе сверху на каждом упражнении.', 3, 50)}
        {num('levelUpWindow', 'Окно последних ответов', 'Сколько последних ответов учитывается для перехода на следующий уровень.', 5, 100)}
        {num('levelUpNeed', 'Верных для перехода', 'Сколько из них должно быть верными, чтобы открылся следующий уровень.', 1, 100)}
        <h2>Песни</h2>
        {num('poolMin', 'Минимум песен в пуле', 'Если на уровне свежих песен меньше, добираются песни более простых уровней.', 1, 50)}
        {num('minSongsPerLevel', 'Цель песен на уровень', 'Порог для подсветки уровней в обзоре.', 1, 500)}
        {bool('hideFlagged', 'Скрывать фрагменты с отметкой «разметка неверна»', 'Ручные отметки убирают фрагмент из корпуса для всех пользователей.')}
        {bool('corpusAutoSync', 'Автоматический импорт корпуса', 'Сервер обновляет коллекции песен из файла конвейера при смене его версии.')}
        <div className="actions"><button className="btn primary" type="submit">Сохранить</button><button className="btn quiet" type="button" onClick={() => { setForm(d); setMsg(''); }}>Сбросить</button><span className={msg === 'Сохранено' ? 'auth-ok' : 'auth-err'}>{msg}</span></div>
      </form>
    </>
  );
}

function RawData({ api }) {
  const [col, setCol] = useState('chordSongs'); const [q, setQ] = useState(''); const [query, setQuery] = useState(''); const [offset, setOffset] = useState(0);
  const [d, reload, err] = useLoad(() => api('GET', `/admin/${col}?q=${encodeURIComponent(query)}&offset=${offset}&limit=50`), [api, col, query, offset]);
  const [open, setOpen] = useState(null); const [draft, setDraft] = useState(''); const [draftErr, setDraftErr] = useState('');
  const [creating, setCreating] = useState(false); const [newDoc, setNewDoc] = useState('{\n  \n}'); const [newErr, setNewErr] = useState('');
  const docs = d ? d.docs : []; const keys = []; docs.forEach(x => Object.keys(x).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
  const pages = d ? Math.max(1, Math.ceil(d.total / 50)) : 1, page = Math.floor(offset / 50) + 1;
  return (
    <>
      <h1>Данные <span className="muted">как есть</span></h1>
      <div className="tabs" role="tablist">{COLS.map(c => <button key={c} role="tab" className={'tab' + (col === c ? ' active' : '')} onClick={() => { setCol(c); setOffset(0); setOpen(null); setQuery(''); setQ(''); }}>{c}</button>)}</div>
      <div className="admin-bar">
        <form className="admin-search" onSubmit={ev => { ev.preventDefault(); setOffset(0); setQuery(q.trim()); }}><input type="search" placeholder="Поиск по содержимому" value={q} onChange={e => setQ(e.target.value)} /><button className="btn quiet mini" type="submit">Найти</button></form>
        <span className="muted">{d ? `${d.total} ${query ? 'найдено' : 'записей'}${pages > 1 ? `, страница ${page} из ${pages}` : ''}` : ''}</span>
        <button className="btn quiet mini" onClick={() => { setCreating(c => !c); setNewErr(''); }}>{creating ? 'Отмена' : '+ Добавить запись'}</button>
      </div>
      {err && <p className="auth-err">{err}</p>}
      {creating && <div className="admin-new"><textarea className="admin-editor" value={newDoc} spellCheck={false} rows={6} onChange={e => setNewDoc(e.target.value)} /><div className="actions admin-editor-actions"><button className="btn primary mini" onClick={async () => { let doc; try { doc = JSON.parse(newDoc); } catch (e) { setNewErr('Некорректный JSON: ' + e.message); return; } try { await api('POST', `/admin/${col}`, { doc }); setCreating(false); toast('Добавлено'); reload(); } catch (e) { setNewErr(e.message); } }}>Создать</button><span className="auth-err">{newErr}</span></div></div>}
      <div className="admin-wrap">
        <table className="admin-table">
          <thead><tr>{keys.map(k => <th key={k}>{k}</th>)}<th /></tr></thead>
          <tbody>
            {docs.map(x => (
              <Fragment key={x.id}>
                <tr className={open === x.id ? 'open' : ''} onClick={() => { const o = open === x.id ? null : x.id; setOpen(o); setDraft(o ? JSON.stringify(x, null, 2) : ''); setDraftErr(''); }}>
                  {keys.map(k => <td key={k} title={typeof x[k] === 'object' ? JSON.stringify(x[k]) : String(x[k] ?? '')}>{fmtVal(x[k])}</td>)}
                  <td><button className="link hist-del" data-tip="Удалить запись" onClick={async ev => { ev.stopPropagation(); if (!await confirmPop(ev.currentTarget, `Удалить запись ${x.id}?`)) return; await api('DELETE', `/admin/${col}/${encodeURIComponent(x.id)}`); toast('Удалено'); reload(); }}>×</button></td>
                </tr>
                {open === x.id && <tr className="admin-json"><td colSpan={keys.length + 1}>
                  <textarea className="admin-editor" value={draft} spellCheck={false} rows={Math.min(30, draft.split('\n').length + 1)} onChange={e => setDraft(e.target.value)} />
                  <div className="actions admin-editor-actions"><button className="btn primary mini" onClick={async () => { let doc; try { doc = JSON.parse(draft); } catch (e) { setDraftErr('Некорректный JSON: ' + e.message); return; } try { await api('PUT', `/admin/${col}/${encodeURIComponent(x.id)}`, { doc }); setDraftErr(''); toast('Сохранено'); reload(); } catch (e) { setDraftErr(e.message); } }}>Сохранить</button><button className="btn quiet mini" onClick={() => { setDraft(JSON.stringify(x, null, 2)); setDraftErr(''); }}>Отменить правки</button><span className="auth-err">{draftErr}</span></div>
                </td></tr>}
              </Fragment>
            ))}
            {d && !docs.length && <tr><td colSpan={keys.length + 1} className="muted">Пусто.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="actions admin-pages"><button className="btn quiet mini" disabled={page <= 1} onClick={() => setOffset(offset - 50)}>← Назад</button><button className="btn quiet mini" disabled={page >= pages} onClick={() => setOffset(offset + 50)}>Вперёд →</button></div>}
    </>
  );
}
