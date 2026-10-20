/*
  주문·결제 API (로컬 server.js 와 Vercel 함수 api/handler.js 가 같이 사용)
  - POST /api/orders                    : 장바구니로 주문을 만들고 DB 가격으로 결제 금액을 계산
  - POST /api/confirm                   : 재고 차감 후 토스페이먼츠 결제 승인 API 호출
  - POST /api/orders/:id/fail           : 결제 실패 / 결제창 닫힘 사유 기록
  - POST /api/orders/:id/cancel         : 주문 취소 (토스 결제 취소 + 재고 복구) - 본인 또는 관리자
  - POST /api/admin/orders/:id/status   : 배송 상태 변경 - 관리자

  데이터는 Supabase(DB)에 저장합니다. 환경변수 SUPABASE_SECRET_KEY 가 있어야 합니다.
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

// 토스페이먼츠 문서용 테스트 시크릿 키 (결제위젯용).
// 실제 연동 시 환경변수 TOSS_SECRET_KEY 에 내 결제위젯 시크릿 키를 넣으세요. 시크릿 키는 절대 브라우저 코드에 넣으면 안 됩니다.
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';
const TOSS_API = 'https://api.tosspayments.com/v1/payments';
const TOSS_AUTH = 'Basic ' + Buffer.from(TOSS_SECRET_KEY + ':').toString('base64');

// Supabase: 시크릿 키는 서버에만 둡니다. (sb_secret_... 키는 apikey 헤더로만 보냄)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://scjzbrghhsnaprjcguly.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

/* 브라우저와 같은 가격 계산 코드(js/products.js)를 서버에서도 사용 */
const shop = {};
vm.createContext(shop);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'js', 'products.js'), 'utf8') +
    '\nthis.salePrice = salePrice; this.deliveryFee = deliveryFee;',
  shop
);

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* ===== Supabase REST ===== */
async function db(method, pathAndQuery, body, prefer) {
  if (!SUPABASE_SECRET_KEY) {
    throw new ApiError(500, 'SERVER_NOT_CONFIGURED', '서버에 DB 키(SUPABASE_SECRET_KEY)가 설정되지 않았습니다. .env 파일을 확인해 주세요.');
  }
  const headers = { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + pathAndQuery, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    console.error('[db]', method, pathAndQuery, res.status, text);
    throw new ApiError(500, 'DB_ERROR', '주문 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  return data;
}

const rpc = (name, args) => db('POST', 'rpc/' + name, args);
const enc = encodeURIComponent;

async function getOrder(orderId) {
  const rows = await db('GET', `orders?id=eq.${enc(orderId)}&select=*`);
  return rows[0] || null;
}

async function updateOrder(orderId, patch) {
  await db('PATCH', `orders?id=eq.${enc(orderId)}`, { ...patch, updated_at: new Date().toISOString() });
}

/* 로그인한 회원 확인 (브라우저가 보낸 로그인 토큰을 Supabase에 확인) */
async function getUser(req) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m || !SUPABASE_SECRET_KEY) return null;
  const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + m[1] }
  });
  if (!res.ok) return null;
  const user = await res.json();
  const rows = await db('GET', `profiles?id=eq.${enc(user.id)}&select=is_admin`);
  return { id: user.id, email: user.email, isAdmin: !!(rows[0] && rows[0].is_admin) };
}

/* ===== 주문 생성 ===== */
const clip = (v, n) => String(v || '').trim().slice(0, n);

async function createOrder(input, user) {
  const items = input.items;
  if (!Array.isArray(items) || !items.length || items.length > 50) {
    throw new ApiError(400, 'EMPTY_ORDER', '주문할 상품이 없습니다.');
  }

  // 같은 상품·사이즈는 하나로 합치기
  const merged = new Map();
  for (const item of items) {
    const id = String(item.id || '');
    const size = String(item.size || '');
    const qty = Math.floor(Number(item.qty));
    if (!/^[\w-]{1,20}$/.test(id) || !size || !(qty >= 1 && qty <= 99)) {
      throw new ApiError(400, 'INVALID_ITEM', '잘못된 주문 상품입니다.');
    }
    const key = id + '|' + size;
    const prev = merged.get(key);
    merged.set(key, { id, size, qty: (prev ? prev.qty : 0) + qty });
  }

  // 가격과 재고는 항상 DB에서 다시 읽음 (브라우저가 보낸 금액은 믿지 않음)
  const ids = [...new Set([...merged.values()].map(i => i.id))];
  const products = await db(
    'GET',
    `products?id=in.(${ids.map(enc).join(',')})&active=eq.true&select=*,product_stock(size,stock)`
  );

  const lines = [...merged.values()].map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) throw new ApiError(400, 'NOT_ON_SALE', '판매하지 않는 상품이 포함되어 있습니다. 장바구니를 확인해 주세요.');
    const stock = product.product_stock.find(s => s.size === item.size);
    if (!stock) throw new ApiError(400, 'INVALID_SIZE', `${product.name}: 선택할 수 없는 사이즈입니다.`);
    if (stock.stock < item.qty) {
      throw new ApiError(
        400,
        'OUT_OF_STOCK',
        stock.stock
          ? `${product.name} (${item.size}) 재고가 부족합니다. 남은 수량은 ${stock.stock}개입니다.`
          : `${product.name} (${item.size})은(는) 품절입니다.`
      );
    }
    const unit = shop.salePrice(product);
    return { product, size: item.size, qty: item.qty, unit, total: unit * item.qty };
  });

  const goods = lines.reduce((sum, line) => sum + line.total, 0);
  const fee = shop.deliveryFee(goods);
  const amount = goods + fee;
  const first = lines[0].product.name;
  const orderName = lines.length > 1 ? `${first} 외 ${lines.length - 1}건` : first;
  // 토스페이먼츠 orderId: 영문, 숫자, -, _ 6~64자
  const orderId = 'ORDER_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

  const c = input.customer || {};
  await db('POST', 'orders', {
    id: orderId,
    user_id: user ? user.id : null,
    status: 'PENDING',
    order_name: orderName,
    goods_amount: goods,
    delivery_fee: fee,
    amount,
    customer_name: clip(c.name, 50),
    customer_phone: clip(c.phone, 20),
    customer_email: clip(c.email, 100),
    address: clip(c.address, 200),
    address_detail: clip(c.addressDetail, 100),
    delivery_memo: clip(c.memo, 100)
  });
  await db(
    'POST',
    'order_items',
    lines.map(line => ({
      order_id: orderId,
      product_id: line.product.id,
      category: line.product.category,
      brand: line.product.brand,
      name: line.product.name,
      color: line.product.color,
      size: line.size,
      qty: line.qty,
      unit_price: line.unit,
      total: line.total
    }))
  );

  return { orderId, amount, orderName };
}

/* ===== 결제 승인 ===== */
function paymentResult(order) {
  return {
    orderId: order.id,
    orderName: order.order_name,
    method: order.method,
    totalAmount: order.amount,
    approvedAt: order.approved_at,
    receiptUrl: order.receipt_url,
    member: !!order.user_id
  };
}

async function confirmPayment({ paymentKey, orderId, amount }) {
  paymentKey = String(paymentKey || '');
  orderId = String(orderId || '');
  const order = await getOrder(orderId);
  if (!order) throw new ApiError(404, 'NOT_FOUND_ORDER', '주문 정보를 찾을 수 없습니다.');

  // 새로고침 등으로 다시 들어온 경우: 이미 승인된 결제면 저장된 결과를 그대로 보여줌 (한 번만 처리)
  if (order.status !== 'PENDING') {
    if (order.payment_key && order.payment_key === paymentKey && order.status !== 'FAILED') {
      return paymentResult(order);
    }
    throw new ApiError(400, 'ALREADY_PROCESSED', '이미 처리된 주문입니다.');
  }

  // 결제창에서 넘어온 금액이 서버가 계산한 금액과 같은지 확인하고, 재고를 차감 (DB에서 한 번에 처리)
  const begin = await rpc('order_begin_confirm', { p_order_id: orderId, p_amount: Math.floor(Number(amount)) || 0 });
  if (begin === 'IN_PROGRESS') throw new ApiError(409, 'IN_PROGRESS', '결제를 처리하는 중입니다. 잠시 후 다시 확인해 주세요.');
  if (begin === 'INVALID_AMOUNT') {
    await rpc('order_mark_failed', { p_order_id: orderId, p_code: 'INVALID_AMOUNT', p_message: '결제 금액이 주문 금액과 일치하지 않습니다.' });
    throw new ApiError(400, 'INVALID_AMOUNT', '결제 금액이 주문 금액과 일치하지 않습니다.');
  }
  if (begin.startsWith('OUT_OF_STOCK:')) {
    const message = `${begin.slice(13)} 재고가 부족해 결제를 진행할 수 없습니다.`;
    await rpc('order_mark_failed', { p_order_id: orderId, p_code: 'OUT_OF_STOCK', p_message: message });
    throw new ApiError(400, 'OUT_OF_STOCK', message);
  }
  if (begin !== 'OK') throw new ApiError(400, 'ALREADY_PROCESSED', '이미 처리된 주문입니다.');

  let res, body;
  try {
    res = await fetch(TOSS_API + '/confirm', {
      method: 'POST',
      headers: { Authorization: TOSS_AUTH, 'Content-Type': 'application/json', 'Idempotency-Key': orderId },
      body: JSON.stringify({ paymentKey, orderId, amount: order.amount })
    });
    body = await res.json();
  } catch (err) {
    res = { ok: false, status: 502 };
    body = { code: 'NETWORK_ERROR', message: '결제 승인 요청 중 오류가 발생했습니다.' };
  }

  if (!res.ok) {
    // 승인 실패: 재고를 되돌리고 실패 사유를 기록
    await rpc('order_mark_failed', { p_order_id: orderId, p_code: body.code || 'CONFIRM_FAILED', p_message: body.message || '결제 승인에 실패했습니다.' });
    throw new ApiError(res.status, body.code || 'CONFIRM_FAILED', body.message || '결제 승인에 실패했습니다.');
  }

  const patch = {
    status: 'PAID',
    payment_key: paymentKey,
    method: body.easyPay && body.easyPay.provider ? `${body.method} (${body.easyPay.provider})` : body.method,
    approved_at: body.approvedAt,
    receipt_url: body.receipt ? body.receipt.url : null
  };
  await updateOrder(orderId, patch);
  return paymentResult({ ...order, ...patch });
}

/* ===== 결제 실패 기록 ===== */
async function recordFailure(orderId, { code, message }) {
  await rpc('order_mark_failed', {
    p_order_id: String(orderId),
    p_code: clip(code, 100) || 'PAY_PROCESS_CANCELED',
    p_message: clip(message, 500) || '결제가 완료되지 않았습니다.'
  });
  return { ok: true };
}

/* ===== 주문 취소 ===== */
const CUSTOMER_CANCELABLE = ['PAID', 'PREPARING'];
const ADMIN_CANCELABLE = ['PAID', 'PREPARING', 'SHIPPING', 'DELIVERED'];

async function cancelOrder(orderId, user, reason) {
  if (!user) throw new ApiError(401, 'LOGIN_REQUIRED', '로그인이 필요합니다.');
  const order = await getOrder(orderId);
  if (!order || (!user.isAdmin && order.user_id !== user.id)) {
    throw new ApiError(404, 'NOT_FOUND_ORDER', '주문 정보를 찾을 수 없습니다.');
  }
  const allowed = user.isAdmin ? ADMIN_CANCELABLE : CUSTOMER_CANCELABLE;
  if (!allowed.includes(order.status)) {
    throw new ApiError(400, 'NOT_CANCELABLE', '지금 상태에서는 주문을 취소할 수 없습니다.');
  }

  const cancelReason = clip(reason, 200) || (user.isAdmin ? '관리자 취소' : '고객 요청 취소');
  const res = await fetch(`${TOSS_API}/${enc(order.payment_key)}/cancel`, {
    method: 'POST',
    headers: { Authorization: TOSS_AUTH, 'Content-Type': 'application/json', 'Idempotency-Key': 'CANCEL_' + orderId },
    body: JSON.stringify({ cancelReason })
  });
  const body = await res.json();
  // 이미 토스에서 취소된 결제라면 DB 상태만 맞춰줌
  if (!res.ok && body.code !== 'ALREADY_CANCELED_PAYMENT') {
    throw new ApiError(res.status, body.code || 'CANCEL_FAILED', body.message || '결제 취소에 실패했습니다.');
  }
  await rpc('order_mark_canceled', { p_order_id: orderId, p_reason: cancelReason });
  return { ok: true, status: 'CANCELED' };
}

/* ===== 관리자: 배송 상태 변경 ===== */
const NEXT_STATUS = { PAID: 'PREPARING', PREPARING: 'SHIPPING', SHIPPING: 'DELIVERED' };

async function changeStatus(orderId, user, status) {
  if (!user || !user.isAdmin) throw new ApiError(403, 'FORBIDDEN', '관리자만 사용할 수 있습니다.');
  const order = await getOrder(orderId);
  if (!order) throw new ApiError(404, 'NOT_FOUND_ORDER', '주문 정보를 찾을 수 없습니다.');
  if (NEXT_STATUS[order.status] !== status) {
    throw new ApiError(400, 'INVALID_STATUS', '바꿀 수 없는 상태입니다. 화면을 새로고침해 주세요.');
  }
  const rows = await db(
    'PATCH',
    `orders?id=eq.${enc(orderId)}&status=eq.${order.status}`,
    { status, updated_at: new Date().toISOString() },
    'return=representation'
  );
  if (!rows.length) throw new ApiError(409, 'CONFLICT', '다른 곳에서 상태가 바뀌었습니다. 화면을 새로고침해 주세요.');
  return { ok: true, status };
}

/* ===== 요청 처리 ===== */
// getUser 는 요청 객체 대신 Authorization 헤더 값만 받음
async function route(method, pathname, body, authorization) {
  if (method !== 'POST') return null;
  const req = { headers: { authorization: authorization || '' } };
  const p = pathname;
  let m;

  if (p === '/api/orders') return createOrder(body, await getUser(req));
  if (p === '/api/confirm') return confirmPayment(body);
  if ((m = p.match(/^\/api\/orders\/([\w-]{6,64})\/fail$/))) return recordFailure(m[1], body);
  if ((m = p.match(/^\/api\/orders\/([\w-]{6,64})\/cancel$/))) return cancelOrder(m[1], await getUser(req), body.reason);
  if ((m = p.match(/^\/api\/admin\/orders\/([\w-]{6,64})\/status$/))) {
    return changeStatus(m[1], await getUser(req), String(body.status || ''));
  }
  return null;
}

/* API 요청 하나를 처리해서 { status, data } 로 돌려줌 */
async function handleApi(method, pathname, body, authorization) {
  try {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiError(400, 'BAD_REQUEST', '잘못된 요청입니다.');
    }
    const result = await route(method, pathname, body, authorization);
    if (result) return { status: 200, data: result };
    return { status: 404, data: { code: 'NOT_FOUND', message: '없는 주소입니다.' } };
  } catch (err) {
    if (!(err instanceof ApiError)) console.error(err);
    return {
      status: err.status || 500,
      data: {
        code: err.code || 'SERVER_ERROR',
        message: err instanceof ApiError ? err.message : '서버 오류가 발생했습니다.'
      }
    };
  }
}

module.exports = { handleApi, isConfigured: () => !!SUPABASE_SECRET_KEY };
