/*
  Supabase 연결 + 로그인 상태 + 상품 목록 + 공통 헤더
  (supabase-js CDN → products.js → db.js → cart.js → 페이지 스크립트 순서로 불러옴)

  브라우저에는 공개용(publishable) 키만 둡니다. 누가 무엇을 볼 수 있는지는 DB 권한(RLS)이 막습니다.
*/
const SUPABASE_URL = 'https://scjzbrghhsnaprjcguly.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_S65DJeeBzSO-IQ66w1dJ3w_noZOCwh9';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/* HTML에 넣는 글자는 꼭 이스케이프 (리뷰 등 사용자가 쓴 글) */
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function formatDate(value, withTime) {
  if (!value) return '-';
  const d = new Date(value);
  return withTime ? d.toLocaleString('ko-KR') : d.toLocaleDateString('ko-KR');
}

/* ===== 로그인 상태 ===== */
const Auth = {
  user: null,
  profile: null,
  ready: null,

  async load() {
    const { data } = await sb.auth.getSession();
    Auth.user = data.session ? data.session.user : null;
    Auth.profile = null;
    if (Auth.user) {
      const res = await sb.from('profiles').select('*').eq('id', Auth.user.id).maybeSingle();
      Auth.profile = res.data;
    }
    return Auth.user;
  },

  get isAdmin() {
    return !!(Auth.profile && Auth.profile.is_admin);
  },

  async token() {
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.access_token : null;
  },

  async signOut() {
    await sb.auth.signOut();
    // 장바구니는 회원 계정에 저장되어 있으므로 이 브라우저에서는 비움
    try {
      localStorage.removeItem('outfit_cart');
      localStorage.removeItem('outfit_cart_owner');
    } catch (e) {}
  },

  /* 로그인이 필요한 페이지: 로그인 안 했으면 로그인 화면으로 */
  async require() {
    await Auth.ready;
    if (!Auth.user) {
      location.replace('login.html?next=' + encodeURIComponent(location.pathname.slice(1) + location.search));
      return false;
    }
    return true;
  }
};
Auth.ready = Auth.load().catch(err => {
  console.error(err);
  return null;
});

/* 서버 API 호출 (로그인했으면 로그인 토큰을 함께 보냄) */
async function api(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await Auth.token();
  if (token) headers.Authorization = 'Bearer ' + token;
  let res, data;
  try {
    res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    data = await res.json();
  } catch (e) {
    throw new Error('서버에 연결하지 못했습니다. 서버(node server.js)가 실행 중인지 확인해 주세요.');
  }
  if (!res.ok) {
    const err = new Error(data.message || '요청을 처리하지 못했습니다.');
    err.code = data.code;
    throw err;
  }
  return data;
}

/* ===== 상품 목록 (DB) ===== */
const Catalog = {
  list: [],
  byId: {},
  loaded: null,

  load() {
    if (!Catalog.loaded) {
      Catalog.loaded = sb
        .from('products')
        .select('*, product_stock(size, stock, sort)')
        .eq('active', true)
        .order('category')
        .order('sort_order')
        .then(({ data, error }) => {
          if (error) throw error;
          Catalog.list = data.map(normalizeProduct);
          Catalog.byId = {};
          Catalog.list.forEach(p => (Catalog.byId[p.id] = p));
          return Catalog.list;
        });
    }
    return Catalog.loaded;
  },

  byCategory(category) {
    return Catalog.list.filter(p => p.category === category);
  }
};

function normalizeProduct(p) {
  const stock = (p.product_stock || []).slice().sort((a, b) => a.sort - b.sort);
  return {
    ...p,
    reviews: p.review_count,
    stock,
    soldOut: !stock.some(s => s.stock > 0)
  };
}

function findProduct(id) {
  return Catalog.byId[id] || null;
}

function stockOf(product, size) {
  const row = product && product.stock.find(s => s.size === size);
  return row ? row.stock : 0;
}

/* ===== 공통 헤더: 로그인 / 로그아웃 / 마이페이지 / 관리자 ===== */
function renderHeader() {
  document.querySelectorAll('.auth-link').forEach(el => {
    el.textContent = Auth.user ? '로그아웃' : '로그인';
    el.href = Auth.user ? '#' : 'login.html?next=' + encodeURIComponent(location.pathname.slice(1) + location.search);
  });
  document.querySelectorAll('.admin-link').forEach(el => (el.hidden = !Auth.isAdmin));
}

document.addEventListener('click', async e => {
  const link = e.target.closest('.auth-link');
  if (link && Auth.user) {
    e.preventDefault();
    await Auth.signOut();
    location.href = 'index.html';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  Auth.ready.then(renderHeader);
});
