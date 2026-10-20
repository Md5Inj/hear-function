/* Все маршруты /api/* ведут в lib/api.js (одна точка, как и раньше). */
import { handleApi } from '@/lib/api';
export const dynamic = 'force-dynamic';
const h = (req, ctx) => ctx.params.then(p => handleApi(req, '/' + p.path.join('/')));
export { h as GET, h as POST, h as PUT, h as DELETE };
