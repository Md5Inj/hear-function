import './style.css';
import { currentUser, currentState } from '@/lib/session';
import AppProvider from '@/components/AppProvider';
import Header from '@/components/Header';

export const metadata = { title: 'Тренажёр слуха', description: 'Относительный слух на настоящей музыке', icons: { icon: 'data:,' } };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }) {
  const user = await currentUser();
  const state = user ? await currentState() : null;
  return (
    <html lang="ru">
      <body>
        <AppProvider user={user} state={state}>
          <div className="wrap wide">
            <Header />
            {children}
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
