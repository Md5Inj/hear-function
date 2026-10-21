'use client';
/* Вход в админку: логин и пароль из коллекции admins. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './AppProvider';
export default function AdminLogin() {
  const router = useRouter(); const [err, setErr] = useState('');
  async function submit(ev) {
    ev.preventDefault(); setErr(''); const f = ev.currentTarget;
    try { await api('POST', '/admin/login', { login: f.login.value, password: f.password.value }); router.refresh(); }
    catch (e) { setErr(e.message); }
  }
  return (
    <section className="account">
      <form className="auth-box admin-login" onSubmit={submit}>
        <div className="auth-title">Вход в админку</div>
        <label>Логин<input name="login" required autoComplete="username" autoFocus /></label>
        <label>Пароль<input type="password" name="password" required autoComplete="current-password" /></label>
        <div className="auth-err">{err}</div>
        <div className="auth-actions"><button className="btn primary" type="submit">Войти</button></div>
      </form>
    </section>
  );
}
