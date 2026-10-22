'use client';
/* Админка: меню слева, разделы — обзор, песни, мелодии, пользователи, отметки, администраторы, настройки, сырые данные. */
import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import Songs from '@/lib/songs-db';
import { sectionEn } from '@/lib/sections';
import { useApp } from './AppProvider';
import { confirmPop, toast, getQuery, setQuery } from './ui';
import SongReview from './SongReview';

const SECTIONS = [
  ['overview', 'Overview'], ['review', 'Song review'], ['chords', 'Song chords'], ['melodies', 'Song melodies'], ['users', 'Users'],
  ['flags', 'Flags'], ['admins', 'Admins'], ['settings', 'Settings'], ['data', 'Data'],
];
const COLS = ['chordSongs', 'melodySongs', 'reviews', 'users', 'admins', 'state', 'seen', 'answers', 'flags', 'customSongs', 'settings', 'meta'];
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const fmtTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const modeName = m => m === 'major' ? 'major' : 'minor';
const fmtVal = v => { if (v == null) return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return s.length > 80 ? s.slice(0, 77) + '…' : s; };

export default function AdminPage({ admin, initial = {} }) {
  const { api, router } = useApp();
  const [section, setSectionState] = useState(() => SECTIONS.some(([k]) => k === initial.s) ? initial.s : 'overview');
  const setSection = useCallback(k => { setSectionState(k); setQuery({ s: k, kind: null, mode: null, level: null, song: null }, true); }, []);
  useEffect(() => { const onPop = () => { const s = getQuery().get('s'); setSectionState(SECTIONS.some(([k]) => k === s) ? s : 'overview'); }; window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="flex items-center gap-2 px-3 pt-1.5 pb-4 font-serif text-base font-medium text-ink-2"><span className="h-2 w-2 shrink-0 rounded-full bg-accent" />Admin panel</div>
        <nav className="admin-nav">{SECTIONS.map(([k, label]) => <button key={k} className={section === k ? 'active' : ''} onClick={() => setSection(k)}>{label}</button>)}</nav>
        <div className="admin-side-foot"><span className="muted">{admin ? admin.login : ''}</span><button className="link" onClick={async () => { await api('POST', '/admin/logout'); router.refresh(); }}>Sign out</button></div>
      </aside>
      <main className="admin-main">
        {section === 'overview' && <Overview api={api} go={setSection} />}
        {section === 'review' && <SongReview initial={initial} />}
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
  if (!d) return <p className="muted">Loading…</p>;
  const min = d.settings.minSongsPerLevel || 20;
  const Levels = ({ mode }) => (
    <div className="admin-levels">
      <h3>{mode === 'major' ? 'Major' : 'Minor'}</h3>
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
      <h1>Overview</h1>
      <div className="admin-cards">
        <button className="admin-card" onClick={() => go('users')}><div className="num">{d.users}</div><div className="label">users</div></button>
        <button className="admin-card" onClick={() => go('chords')}><div className="num">{d.chordSongs}</div><div className="label">chord fragments</div></button>
        <button className="admin-card" onClick={() => go('melodies')}><div className="num">{d.melodySongs}</div><div className="label">vocal phrases</div></button>
        <div className="admin-card"><div className="num">{d.answers}</div><div className="label">answers, today {d.answersToday}</div></div>
        <button className="admin-card" onClick={() => go('flags')}><div className="num">{d.flags}</div><div className="label">flags</div></button>
        <div className="admin-card"><div className="num small">{d.lastImport ? fmtDate(d.lastImport) : '—'}</div><div className="label">last corpus import</div></div>
      </div>
      <h2>Songs per level</h2>
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
      <h1>{kind === 'melody' ? 'Song melodies' : 'Song chords'} <span className="muted">{all ? all.length : ''}</span></h1>
      <div className="admin-filters">
        <input type="search" placeholder="Title, artist or id" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
        <select value={mode} onChange={e => { setMode(e.target.value); setLevel('all'); setPage(0); }}><option value="all">Both keys</option><option value="major">Major</option><option value="minor">Minor</option></select>
        {kind !== 'melody' && <select value={level} onChange={e => { setLevel(e.target.value); setPage(0); }}><option value="all">All levels</option>{levels.map((l, i) => <option key={i} value={i + 1}>{i + 1}. {l.title}</option>)}</select>}
        <span className="muted">{list.length} {list.length === all?.length ? 'total' : 'found'}</span>
      </div>
      {!all && <p className="muted">Loading…</p>}
      <div className="admin-songs">
        {list.slice(page * PAGE, page * PAGE + PAGE).map(({ raw: s, e, level: lv }) => (
          <div key={s.id} className={'admin-song' + (edit === s.id ? ' open' : '')}>
            <a className="adm-thumb" href={'https://www.youtube.com/watch?v=' + s.youtube + '&t=' + Math.floor(s.start)} target="_blank" rel="noreferrer" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${s.youtube}/mqdefault.jpg)` }} aria-label="Open on YouTube" />
            <div className="adm-info">
              <div className="title">{s.title} <span className="muted">· {s.artist}</span></div>
              <div className="meta">{modeName(e.key.mode)}{lv ? `, level ${lv}` : ', off the ladder'} · {sectionEn(s.section) || 'fragment'} · {fmtTime(s.start)}–{fmtTime(e.end)} · {Songs.barsOf(s)} bars · {e.bpm} bpm{s.source === 'hand' ? ' · manual' : ''}{s.edited ? ' · edited' : ''}</div>
              <div className="chords">{kind === 'melody' ? s.melody.degrees.join(' ') : s.chords.map(c => c.c).join(' – ')}</div>
            </div>
            <div className="adm-acts">
              <a className="btn quiet mini" href={(kind === 'melody' ? '/melodies' : '/songs') + '?song=' + encodeURIComponent(s.id)} target="_blank" rel="noreferrer">Open</a>
              <button className="btn quiet mini" onClick={() => { setEdit(edit === s.id ? null : s.id); setDraft(JSON.stringify(s, null, 2)); setDraftErr(''); }}>{edit === s.id ? 'Collapse' : 'Edit'}</button>
              <button className="link hist-del" data-tip="Delete" onClick={async ev => { if (!await confirmPop(ev.currentTarget, `Delete "${s.title}"?`)) return; await api('DELETE', `/admin/${col}/${encodeURIComponent(s.id)}`); toast('Deleted'); reload(); }}>×</button>
            </div>
            {edit === s.id && (
              <div className="editor">
                <textarea className="admin-editor" value={draft} spellCheck={false} rows={Math.min(28, draft.split('\n').length + 1)} onChange={e => setDraft(e.target.value)} />
                <div className="actions admin-editor-actions">
                  <button className="btn primary mini" onClick={async () => { let doc; try { doc = JSON.parse(draft); } catch (x) { setDraftErr('Invalid JSON: ' + x.message); return; } try { await api('PUT', `/admin/${col}/${encodeURIComponent(s.id)}`, { doc }); toast('Saved'); setEdit(null); reload(); } catch (x) { setDraftErr(x.message); } }}>Save</button>
                  <button className="btn quiet mini" onClick={() => setEdit(null)}>Cancel</button><span className="auth-err">{draftErr}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {pages > 1 && <div className="actions admin-pages"><button className="btn quiet mini" disabled={page <= 0} onClick={() => setPage(page - 1)}>← Back</button><span className="muted">page {page + 1} of {pages}</span><button className="btn quiet mini" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button></div>}
    </>
  );
}

function Users({ api }) {
  const [d, reload, err] = useLoad(() => api('GET', '/admin/users'), [api]);
  if (err) return <p className="auth-err">{err}</p>;
  const prog = p => Object.entries(p || {}).filter(([, v]) => v && v.total).map(([k, v]) => { const [ex, mode] = k.split('.'); const names = { degrees: 'degrees', progressions: 'progressions', songs: 'chords', melodies: 'melodies' }; return `${names[ex] || ex} ${modeName(mode)}: lv. ${v.level}`; });
  return (
    <>
      <h1>Users <span className="muted">{d ? d.users.length : ''}</span></h1>
      {!d && <p className="muted">Loading…</p>}
      <div className="admin-list">
        {d && d.users.map(u => (
          <div key={u.id} className="admin-row">
            <div className="adm-info">
              <div className="title">{u.name} <span className="muted">· {u.email}</span></div>
              <div className="meta">since {fmtDate(u.created)} · answers {u.answers.total}, correct {u.answers.correct}{u.answers.last ? ` · last ${fmtDate(u.answers.last)}` : ''}</div>
              {prog(u.progress).length > 0 && <div className="meta">{prog(u.progress).join(' · ')}</div>}
            </div>
            <div className="adm-acts"><button className="link hist-del" data-tip="Delete the user and their data" onClick={async ev => { if (!await confirmPop(ev.currentTarget, `Delete ${u.email} with all progress?`)) return; await api('DELETE', `/admin/users/${encodeURIComponent(u.id)}`); toast('Deleted'); reload(); }}>×</button></div>
          </div>
        ))}
        {d && !d.users.length && <p className="muted">No one yet.</p>}
      </div>
    </>
  );
}

function Flags({ api }) {
  const [d, reload, err] = useLoad(() => api('GET', '/admin/flags?limit=2000'), [api]);
  if (err) return <p className="auth-err">{err}</p>;
  const reasons = { unavailable: 'clip failed to load (stale automatic flag)', wrong: 'annotation wrong' };
  return (
    <>
      <h1>Flags <span className="muted">{d ? d.total : ''}</span></h1>
      <p className="hist-note">Manual "markup is wrong" flags hide the fragment from the corpus for everyone (see the setting). Automatic player flags have no effect.</p>
      <div className="admin-list">
        {d && d.docs.map(f => (
          <div key={f.id} className="admin-row">
            <div className="adm-info"><div className="title">{f.title || f.songId} <span className="muted">· {f.artist || ''}</span></div><div className="meta">{reasons[f.reason] || f.reason || 'no reason'} · {f.task || ''} · {fmtDate(f.at)}</div></div>
            <div className="adm-acts"><button className="link hist-del" data-tip="Clear flag" onClick={async ev => { if (!await confirmPop(ev.currentTarget, 'Clear the flag?')) return; await api('DELETE', `/admin/flags/${encodeURIComponent(f.id)}`); reload(); }}>×</button></div>
          </div>
        ))}
        {d && !d.docs.length && <p className="muted">No flags.</p>}
      </div>
    </>
  );
}

function Admins({ api, me }) {
  const [d, reload, err] = useLoad(() => api('GET', '/admin/admins'), [api]);
  const [formErr, setFormErr] = useState('');
  async function add(ev) {
    ev.preventDefault(); setFormErr(''); const f = ev.currentTarget;
    try { await api('POST', '/admin/admins', { doc: { login: f.login.value.trim(), password: f.password.value, at: new Date().toISOString() } }); f.reset(); toast('Admin added'); reload(); } catch (e) { setFormErr(e.message); }
  }
  return (
    <>
      <h1>Administrators</h1>
      {err && <p className="auth-err">{err}</p>}
      <div className="admin-list">
        {d && d.docs.map(a => (
          <div key={a.id} className="admin-row">
            <div className="adm-info"><div className="title">{a.login}{me && me.id === a.id ? <span className="muted"> · this is you</span> : null}</div><div className="meta">since {fmtDate(a.at)}</div></div>
            <div className="adm-acts">{me && me.id !== a.id && <button className="link hist-del" data-tip="Delete" onClick={async ev => { if (!await confirmPop(ev.currentTarget, `Delete admin ${a.login}?`)) return; await api('DELETE', `/admin/admins/${encodeURIComponent(a.id)}`); reload(); }}>×</button>}</div>
          </div>
        ))}
      </div>
      <h2>Add administrator</h2>
      <form className="admin-form" onSubmit={add}>
        <label>Login<input name="login" required autoComplete="off" /></label>
        <label>Password<input name="password" type="password" required minLength={6} autoComplete="new-password" /></label>
        <div className="actions"><button className="btn primary" type="submit">Add</button><span className="auth-err">{formErr}</span></div>
      </form>
    </>
  );
}

function Settings({ api, router }) {
  const [d, reload, err] = useLoad(() => api('GET', '/admin/settings').then(x => x.settings), [api]);
  const [form, setForm] = useState(null); const [msg, setMsg] = useState('');
  useEffect(() => { if (d) setForm(d); }, [d]);
  if (err) return <p className="auth-err">{err}</p>;
  if (!form) return <p className="muted">Loading…</p>;
  const num = (k, label, hint, min, max) => <label className="admin-setting"><span><b>{label}</b><small>{hint}</small></span><input type="number" min={min} max={max} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></label>;
  const bool = (k, label, hint) => <label className="admin-setting check"><input type="checkbox" checked={!!form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} /><span><b>{label}</b><small>{hint}</small></span></label>;
  return (
    <>
      <h1>Settings</h1>
      <form className="admin-settings" onSubmit={async ev => { ev.preventDefault(); setMsg(''); try { const r = await api('PUT', '/admin/settings', form); setForm(r.settings); setMsg('Saved'); toast('Settings saved'); router.refresh(); } catch (e) { setMsg(e.message); } }}>
        <h2>Exercises</h2>
        {num('sessionLength', 'Questions per series', 'Length of the series in the top bar of each exercise.', 3, 50)}
        {num('levelUpWindow', 'Window of recent answers', 'How many recent answers count toward moving to the next level.', 5, 100)}
        {num('levelUpNeed', 'Correct to advance', 'How many of them must be correct to open the next level.', 1, 100)}
        <h2>Songs</h2>
        {num('poolMin', 'Minimum songs in the pool', 'If a level has fewer fresh songs, songs from easier levels are added.', 1, 50)}
        {num('minSongsPerLevel', 'Target songs per level', 'Threshold for highlighting levels in the overview.', 1, 500)}
        {bool('hideFlagged', 'Hide fragments flagged "annotation wrong"', 'Manual flags remove a fragment from the corpus for all users.')}
        {bool('corpusAutoSync', 'Automatic corpus import', 'The server updates song collections from the pipeline file when its version changes.')}
        <div className="actions"><button className="btn primary" type="submit">Save</button><button className="btn quiet" type="button" onClick={() => { setForm(d); setMsg(''); }}>Reset</button><span className={msg === 'Saved' ? 'auth-ok' : 'auth-err'}>{msg}</span></div>
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
      <h1>Data <span className="muted">as is</span></h1>
      <div className="tabs" role="tablist">{COLS.map(c => <button key={c} role="tab" className={'tab' + (col === c ? ' active' : '')} onClick={() => { setCol(c); setOffset(0); setOpen(null); setQuery(''); setQ(''); }}>{c}</button>)}</div>
      <div className="admin-bar">
        <form className="admin-search" onSubmit={ev => { ev.preventDefault(); setOffset(0); setQuery(q.trim()); }}><input type="search" placeholder="Search by content" value={q} onChange={e => setQ(e.target.value)} /><button className="btn quiet mini" type="submit">Find</button></form>
        <span className="muted">{d ? `${d.total} ${query ? 'found' : 'records'}${pages > 1 ? `, page ${page} of ${pages}` : ''}` : ''}</span>
        <button className="btn quiet mini" onClick={() => { setCreating(c => !c); setNewErr(''); }}>{creating ? 'Cancel' : '+ Add record'}</button>
      </div>
      {err && <p className="auth-err">{err}</p>}
      {creating && <div className="admin-new"><textarea className="admin-editor" value={newDoc} spellCheck={false} rows={6} onChange={e => setNewDoc(e.target.value)} /><div className="actions admin-editor-actions"><button className="btn primary mini" onClick={async () => { let doc; try { doc = JSON.parse(newDoc); } catch (e) { setNewErr('Invalid JSON: ' + e.message); return; } try { await api('POST', `/admin/${col}`, { doc }); setCreating(false); toast('Added'); reload(); } catch (e) { setNewErr(e.message); } }}>Create</button><span className="auth-err">{newErr}</span></div></div>}
      <div className="admin-wrap">
        <table className="admin-table">
          <thead><tr>{keys.map(k => <th key={k}>{k}</th>)}<th /></tr></thead>
          <tbody>
            {docs.map(x => (
              <Fragment key={x.id}>
                <tr className={open === x.id ? 'open' : ''} onClick={() => { const o = open === x.id ? null : x.id; setOpen(o); setDraft(o ? JSON.stringify(x, null, 2) : ''); setDraftErr(''); }}>
                  {keys.map(k => <td key={k} title={typeof x[k] === 'object' ? JSON.stringify(x[k]) : String(x[k] ?? '')}>{fmtVal(x[k])}</td>)}
                  <td><button className="link hist-del" data-tip="Delete record" onClick={async ev => { ev.stopPropagation(); if (!await confirmPop(ev.currentTarget, `Delete record ${x.id}?`)) return; await api('DELETE', `/admin/${col}/${encodeURIComponent(x.id)}`); toast('Deleted'); reload(); }}>×</button></td>
                </tr>
                {open === x.id && <tr className="admin-json"><td colSpan={keys.length + 1}>
                  <textarea className="admin-editor" value={draft} spellCheck={false} rows={Math.min(30, draft.split('\n').length + 1)} onChange={e => setDraft(e.target.value)} />
                  <div className="actions admin-editor-actions"><button className="btn primary mini" onClick={async () => { let doc; try { doc = JSON.parse(draft); } catch (e) { setDraftErr('Invalid JSON: ' + e.message); return; } try { await api('PUT', `/admin/${col}/${encodeURIComponent(x.id)}`, { doc }); setDraftErr(''); toast('Saved'); reload(); } catch (e) { setDraftErr(e.message); } }}>Save</button><button className="btn quiet mini" onClick={() => { setDraft(JSON.stringify(x, null, 2)); setDraftErr(''); }}>Revert edits</button><span className="auth-err">{draftErr}</span></div>
                </td></tr>}
              </Fragment>
            ))}
            {d && !docs.length && <tr><td colSpan={keys.length + 1} className="muted">Empty.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="actions admin-pages"><button className="btn quiet mini" disabled={page <= 1} onClick={() => setOffset(offset - 50)}>← Back</button><button className="btn quiet mini" disabled={page >= pages} onClick={() => setOffset(offset + 50)}>Next →</button></div>}
    </>
  );
}
