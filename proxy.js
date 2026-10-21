/* Служебная страница базы живёт по секретному адресу из app.config.js: /<adminPath> показывает /admin,
   а прямой /admin для всех остальных адресов отвечает 404. */
import { NextResponse } from 'next/server';
import appConfig from './app.config';
const ok = /^admin_[a-z0-9]{6}$/i.test(appConfig.adminPath);
export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (ok && pathname === '/' + appConfig.adminPath) { const u = new URL(request.url); u.pathname = '/admin'; return NextResponse.rewrite(u); }  // параметры (раздел, уровень, песня) сохраняем
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return NextResponse.rewrite(new URL('/__not_found__', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/admin', '/:slug'] };
