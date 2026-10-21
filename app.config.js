/* Настройки приложения. Переменные окружения с теми же именами имеют приоритет. */
const config = {
  // адрес служебной страницы базы: admin, подчёркивание и шесть символов; прямой /admin не открывается
  adminPath: process.env.ADMIN_PATH || 'admin_r75hu1',
  // первый администратор: создаётся в коллекции admins, если она пуста; дальше администраторы правятся на самой странице
  adminLogin: process.env.ADMIN_LOGIN || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'Tomorrowmc1',
  // секрет подписи cookie входа в админку; смените при утечке — все входы сбросятся
  adminSecret: process.env.ADMIN_SECRET || 'e89428babe1e3d956d5ffe34c3393110d9af1a1ce4bc807a8be237ebd85a21e6',
};
export default config;
