import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'ru'];
export const defaultLocale = 'en';

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get('locale')?.value;
  const locale = locales.includes(cookieLocale) ? cookieLocale : defaultLocale;
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
