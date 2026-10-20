/* Серверные помощники страниц упражнений: требование входа и лад из адреса (?mode=major|minor). */
import { redirect } from 'next/navigation';
import { currentUserFull } from './session';
import { getStore } from './db';
export async function requireUser(nextPath) {
  const u = await currentUserFull();
  if (!u) redirect('/?login=1&next=' + encodeURIComponent(nextPath));
  return u;
}
/* Лад страницы: из адреса (?mode=major|minor, подпункт меню) или сохранённый. Здесь ничего не пишем:
   GET может прийти от предзагрузки ссылок, сохраняет лад клиент после настоящего перехода. */
export async function resolveMode(user, searchParams) {
  const sp = (await searchParams) || {}; const m = sp.mode;
  if (m === 'major' || m === 'minor') return m;
  const st = await getStore().get('state', user.id);
  return st && st.settings && st.settings.mode === 'minor' ? 'minor' : 'major';
}
