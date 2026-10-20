/*
  Vercel 서버리스 함수: /api/* 요청을 lib/api.js 로 넘김
  vercel.json 의 rewrites 가 /api/orders/... 를 /api/handler?path=orders/... 로 보냄
  시크릿 키는 Vercel 프로젝트의 환경변수(SUPABASE_SECRET_KEY)에서 읽음
*/
const { handleApi } = require('../lib/api');

module.exports = async (req, res) => {
  const raw = req.query && req.query.path;
  const sub = Array.isArray(raw) ? raw.join('/') : String(raw || '');
  const pathname = '/api/' + sub.replace(/^\/+/, '');

  let body = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    } catch (e) {
      body = null;
    }
  }

  const { status, data } = await handleApi(req.method, pathname, body, req.headers.authorization);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(data));
};
