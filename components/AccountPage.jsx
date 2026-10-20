'use client';
/* Аккаунт: смена почты и пароля с проверкой текущего пароля. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './AppProvider';
import { toast } from './ui';

export default function AccountPage() {
  const { store, api, refresh } = useApp(); const router = useRouter();
  const [email, setEmail] = useState(store.user ? store.user.email : '');
  const [e1, setE1] = useState(''), [ok1, setOk1] = useState(''), [e2, setE2] = useState(''), [ok2, setOk2] = useState('');
  async function changeEmail(ev) {
    ev.preventDefault(); setE1(''); setOk1(''); const f = ev.currentTarget;
    try { const d = await api('POST', '/account/email', { email, password: f.password.value }); store.user = d.user; refresh(); router.refresh(); f.password.value = ''; setOk1('Почта изменена'); toast('Почта изменена'); }
    catch (e) { setE1(e.message); }
  }
  async function changePassword(ev) {
    ev.preventDefault(); setE2(''); setOk2(''); const f = ev.currentTarget;
    if (f.np.value !== f.np2.value) { setE2('Новые пароли не совпадают'); return; }
    try { await api('POST', '/account/password', { password: f.old.value, newPassword: f.np.value }); f.reset(); setOk2('Пароль изменён'); toast('Пароль изменён'); }
    catch (e) { setE2(e.message); }
  }
  return (
    <section className="account">
      <div className="hist-head"><h1>Аккаунт</h1></div>
      <form className="acc-row" onSubmit={changeEmail}>
        <div className="acc-info"><div className="acc-title">Почта</div><div className="acc-desc">Адрес для входа. Сейчас: <span>{store.user ? store.user.email : ''}</span></div></div>
        <div className="acc-fields">
          <label>Email<input type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Текущий пароль<input type="password" name="password" required autoComplete="current-password" /></label>
          <div className="acc-actions"><button className="btn primary" type="submit">Сменить почту</button><span className="auth-err">{e1}</span><span className="auth-ok">{ok1}</span></div>
        </div>
      </form>
      <form className="acc-row" onSubmit={changePassword}>
        <div className="acc-info"><div className="acc-title">Пароль</div><div className="acc-desc">Не короче шести символов.</div></div>
        <div className="acc-fields">
          <label>Текущий пароль<input type="password" name="old" required autoComplete="current-password" /></label>
          <div className="acc-two">
            <label>Новый пароль<input type="password" name="np" required minLength={6} autoComplete="new-password" /></label>
            <label>Ещё раз<input type="password" name="np2" required minLength={6} autoComplete="new-password" /></label>
          </div>
          <div className="acc-actions"><button className="btn primary" type="submit">Сменить пароль</button><span className="auth-err">{e2}</span><span className="auth-ok">{ok2}</span></div>
        </div>
      </form>
    </section>
  );
}
