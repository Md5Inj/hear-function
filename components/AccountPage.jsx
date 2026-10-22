'use client';
/* Аккаунт: смена почты и пароля с проверкой текущего пароля. Вёрстка на Tailwind. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './AppProvider';
import { toast } from './ui';
import { Button } from './ui/button';

const row = 'grid grid-cols-1 min-[640px]:grid-cols-[minmax(200px,1fr)_minmax(0,2fr)] gap-6 min-[640px]:gap-x-12 py-7 border-t border-rule';
const fieldWrap = 'grid gap-3.5 max-w-[520px]';
const lbl = 'grid gap-1.5 text-sm text-ink-2';
const inp = 'font-sans text-base text-ink bg-paper border border-rule rounded-[10px] px-3 py-2.5 focus:outline-2 focus:outline-accent focus:border-accent';

export default function AccountPage() {
  const { store, api, refresh } = useApp(); const router = useRouter();
  const [email, setEmail] = useState(store.user ? store.user.email : '');
  const [e1, setE1] = useState(''), [ok1, setOk1] = useState(''), [e2, setE2] = useState(''), [ok2, setOk2] = useState('');
  async function changeEmail(ev) {
    ev.preventDefault(); setE1(''); setOk1(''); const f = ev.currentTarget;
    try { const d = await api('POST', '/account/email', { email, password: f.password.value }); store.user = d.user; refresh(); router.refresh(); f.password.value = ''; setOk1('Email changed'); toast('Email changed'); }
    catch (e) { setE1(e.message); }
  }
  async function changePassword(ev) {
    ev.preventDefault(); setE2(''); setOk2(''); const f = ev.currentTarget;
    if (f.np.value !== f.np2.value) { setE2('The new passwords do not match'); return; }
    try { await api('POST', '/account/password', { password: f.old.value, newPassword: f.np.value }); f.reset(); setOk2('Password changed'); toast('Password changed'); }
    catch (e) { setE2(e.message); }
  }
  return (
    <section>
      <div className="pt-7"><h1 className="font-serif font-medium text-[30px] m-0">Account</h1></div>
      <form className={row} onSubmit={changeEmail}>
        <div><div className="font-serif text-[22px] font-medium mb-1.5">Email</div><div className="text-ink-2 text-sm leading-normal">Your sign-in address. Now: <span>{store.user ? store.user.email : ''}</span></div></div>
        <div className={fieldWrap}>
          <label className={lbl}>Email<input className={inp} type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label className={lbl}>Current password<input className={inp} type="password" name="password" required autoComplete="current-password" /></label>
          <div className="flex items-center gap-3.5 flex-wrap mt-1"><Button variant="primary" size="primary" type="submit">Change email</Button><span className="text-bad text-sm">{e1}</span><span className="text-ok text-sm">{ok1}</span></div>
        </div>
      </form>
      <form className={row} onSubmit={changePassword}>
        <div><div className="font-serif text-[22px] font-medium mb-1.5">Password</div><div className="text-ink-2 text-sm leading-normal">At least six characters.</div></div>
        <div className={fieldWrap}>
          <label className={lbl}>Current password<input className={inp} type="password" name="old" required autoComplete="current-password" /></label>
          <div className="grid grid-cols-2 gap-3.5">
            <label className={lbl}>New password<input className={inp} type="password" name="np" required minLength={6} autoComplete="new-password" /></label>
            <label className={lbl}>Repeat<input className={inp} type="password" name="np2" required minLength={6} autoComplete="new-password" /></label>
          </div>
          <div className="flex items-center gap-3.5 flex-wrap mt-1"><Button variant="primary" size="primary" type="submit">Change password</Button><span className="text-bad text-sm">{e2}</span><span className="text-ok text-sm">{ok2}</span></div>
        </div>
      </form>
    </section>
  );
}
