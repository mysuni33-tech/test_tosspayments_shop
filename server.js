/*
  OUTFIT 쇼핑몰 로컬 서버 (외부 패키지 없이 Node.js 기본 모듈만 사용)
  - 정적 파일 제공 (HTML/CSS/JS)
  - /api/* 주문·결제 요청은 lib/api.js 가 처리 (Vercel 에서는 api/handler.js 가 같은 코드를 씀)

  .env 에 SUPABASE_SECRET_KEY 가 있어야 주문/결제가 됩니다.
  실행: node server.js  →  http://localhost:8080
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

/* .env 파일 읽기 (KEY=VALUE 형식, 이미 있는 환경변수가 우선) */
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .forEach(line => {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    });
} catch (e) {}

const PORT = Number(process.env.PORT) || 8080;
const { handleApi, isConfigured } = require('./lib/api');

/* ===== HTTP ===== */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};
const PUBLIC = /^\/(?:[\w-]+\.html|css\/[\w.-]+|js\/[\w.-]+|images\/[\w.-]+)$/;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e5) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (e) {
        reject(new Error('잘못된 요청입니다.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    let body;
    try {
      body = req.method === 'POST' ? await readJson(req) : {};
    } catch (e) {
      body = null;
    }
    const { status, data } = await handleApi(req.method, url.pathname, body, req.headers.authorization);
    return sendJson(res, status, data);
  }

  // 정적 파일 (server.js 같은 서버 파일은 노출하지 않음)
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (req.method !== 'GET' || !PUBLIC.test(pathname)) {
    res.writeHead(404);
    return res.end('Not Found');
  }
  fs.readFile(path.join(ROOT, pathname), (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(pathname)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`OUTFIT server: http://localhost:${PORT}`);
  if (!isConfigured()) console.warn('[주의] .env 에 SUPABASE_SECRET_KEY 가 없어 주문/결제를 처리할 수 없습니다.');
});
