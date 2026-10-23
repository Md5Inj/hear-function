import './style.css';
import { Analytics } from '@vercel/analytics/next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { currentState, currentUserFull } from '@/lib/session';
import { appSettings } from '@/lib/api';
import AppProvider from '@/components/AppProvider';

export const metadata = { title: 'hear function', description: 'Relative pitch on real music' };
export const dynamic = 'force-dynamic';

/* Корневой каркас: провайдеры локали (next-intl) и состояния. Шапка — в app/(site)/layout.js. */
export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const full = await currentUserFull();
  const user = full ? { id: full.id, email: full.email, name: full.name } : null;
  const state = user ? await currentState() : null;
  const settings = await appSettings();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale}>
          <AppProvider user={user} state={state} settings={settings}>{children}</AppProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
