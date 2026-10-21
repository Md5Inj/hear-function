import './style.css';
import { currentState, currentUserFull } from '@/lib/session';
import { appSettings } from '@/lib/api';
import AppProvider from '@/components/AppProvider';

export const metadata = { title: 'Тренажёр слуха', description: 'Относительный слух на настоящей музыке', icons: { icon: 'data:,' } };
export const dynamic = 'force-dynamic';

/* Корневой каркас: только провайдер состояния. Шапка сайта — в app/(site)/layout.js, админка — в app/admin/layout.js. */
export default async function RootLayout({ children }) {
  const full = await currentUserFull();
  const user = full ? { id: full.id, email: full.email, name: full.name } : null;
  const state = user ? await currentState() : null;
  const settings = await appSettings();
  return (
    <html lang="ru">
      <body>
        <AppProvider user={user} state={state} settings={settings}>{children}</AppProvider>
      </body>
    </html>
  );
}
