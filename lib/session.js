/* Текущий пользователь и его состояние для серверных компонентов (по cookie sid). */
import { cookies } from 'next/headers';
import { userBySid, publicUser, userState } from './api';
export async function currentUser() {
  const c = await cookies();
  return publicUser(await userBySid(c.get('sid')?.value));
}
export async function currentUserFull() {
  const c = await cookies();
  return userBySid(c.get('sid')?.value);
}
export async function currentState() {
  const u = await currentUserFull();
  return u ? await userState(u) : null;
}
