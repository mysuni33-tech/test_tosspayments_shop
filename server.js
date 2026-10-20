/*
  OUTFIT 쇼핑몰 서버 (외부 패키지 없이 Node.js 기본 모듈만 사용)
  - 정적 파일 제공 (HTML/CSS/JS)
  - POST /api/orders   : 장바구니로 주문을 만들고 서버에서 결제 금액을 계산
  - POST /api/confirm  : 토스페이먼츠 결제 승인 API 호출

  실행: node server.js  →  http://localhost:8080
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;

// 토스페이먼츠 문서용 테스트 시크릿 키 (결제위젯용).
// 실제 연동 시 환경변수 TOSS_SECRET_KEY 에 내 결제위젯 시크릿 키를 넣으세요. 시크릿 키는 절대 브라우저 코드에 넣으면 안 됩니다.
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';
const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

const FREE_DELIVERY = 50000;
const DELIVERY_FEE = 3000;

/* 브라우저와 같은 상품 데이터(js/products.js)를 서버에서도 사용 */
const shop = {};
vm.createContext(shop);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'js', 'products.js'), 'utf8') +
    '\nthis.findProduct = findProduct; this.salePrice = salePrice;',
  shop
);

/* 결제 대기 중인 주문 (데모용 메모리 저장소. 실제 서비스에서는 DB에 저장) */
const orders = new Map();

function createOrder(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('주문할 상품이 없습니다.');

  const lines = items.map(item => {
    const product = shop.findProduct(String(item.id));
    const qty = Math.floor(Number(item.qty));
    if (!product || !(qty >= 1 && qty <= 99)) throw new Error('잘못된 주문 상품입니다.');
    return { product, qty, size: String(item.size || ''), total: shop.salePrice(product) * qty };
  });

  const goods = lines.reduce((sum, line) => sum + line.total, 0);
  const amount = goods + (goods >= FREE_DELIVERY ? 0 : DELIVERY_FEE);
  const first = lines[0].product.name;
  const orderName = lines.length > 1 ? `${first} 외 ${lines.length - 1}건` : first;
  // 토스페이먼츠 orderId: 영문, 숫자, -, _ 6~64자
  const orderId = 'ORDER_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

  orders.set(orderId, { amount, orderName, status: 'READY' });
  return { orderId, amount, orderName };
}

async function confirmPayment({ paymentKey, orderId, amount }) {
  const order = orders.get(orderId);
  if (!order) return { status: 404, body: { code: 'NOT_FOUND_ORDER', message: '주문 정보를 찾을 수 없습니다.' } };
  if (order.status === 'DONE') return { status: 400, body: { code: 'ALREADY_PROCESSED', message: '이미 처리된 주문입니다.' } };
  // 결제창에서 넘어온 금액이 서버가 계산한 금액과 같은지 반드시 확인
  if (Number(amount) !== order.amount) {
    return { status: 400, body: { code: 'INVALID_AMOUNT', message: '결제 금액이 주문 금액과 일치하지 않습니다.' } };
  }

  const res = await fetch(TOSS_CONFIRM_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(TOSS_SECRET_KEY + ':').toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ paymentKey, orderId, amount: order.amount })
  });
  const body = await res.json();
  if (res.ok) order.status = 'DONE';
  return { status: res.status, body };
}

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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
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

  try {
    if (req.method === 'POST' && url.pathname === '/api/orders') {
      const { items } = await readJson(req);
      return sendJson(res, 200, createOrder(items));
    }
    if (req.method === 'POST' && url.pathname === '/api/confirm') {
      const result = await confirmPayment(await readJson(req));
      return sendJson(res, result.status, result.body);
    }
  } catch (err) {
    return sendJson(res, 400, { code: 'BAD_REQUEST', message: err.message });
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

server.listen(PORT, () => console.log(`OUTFIT server: http://localhost:${PORT}`));
