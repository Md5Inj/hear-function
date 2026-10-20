/* Локальный сервер: статика + API. npm start */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { handle } = require('./server/api');

const PORT = process.env.PORT || 8765;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handle(req, res);
  let file = decodeURIComponent(req.url.split('?')[0]);
  if (file === '/') file = '/index.html';
  const full = path.join(ROOT, path.normalize(file));
  if (!full.startsWith(ROOT) || full.includes(path.sep + 'data' + path.sep) || full.includes(path.sep + 'server' + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(full).pipe(res);
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}/`; // именно localhost: со 127.0.0.1 YouTube не даёт играть музыкальные ролики
  console.log(`Тренажёр слуха: ${url}  (Ctrl+C — остановить)`);
  if (!process.env.NO_OPEN) exec(`xdg-open ${url} 2>/dev/null || open ${url} 2>/dev/null || start ${url}`);
});
