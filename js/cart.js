/*
  장바구니 + 공통 UI
  - 이 브라우저의 장바구니는 localStorage 에 저장
  - 로그인하면 DB(cart_items)와 동기화해서 다른 기기에서도 같은 장바구니가 보임
*/
const CART_KEY = 'outfit_cart';
const CART_OWNER_KEY = 'outfit_cart_owner'; // 이 브라우저 장바구니가 어느 회원 것인지
const ORDER_KEY = 'outfit_order';

const Cart = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  },
  save(items, skipSync) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (e) {}
    updateCartCount();
    if (!skipSync) pushCart();
  },
  add(id, size, qty) {
    const items = Cart.get();
    const found = items.find(item => item.id === id && item.size === size);
    if (found) found.qty = Math.min(99, found.qty + qty);
    else items.push({ id, size, qty });
    Cart.save(items);
  },
  setQty(index, qty) {
    const items = Cart.get();
    if (!items[index]) return;
    items[index].qty = Math.max(1, Math.min(99, qty));
    Cart.save(items);
  },
  remove(index) {
    const items = Cart.get();
    items.splice(index, 1);
    Cart.save(items);
  },
  clear() {
    Cart.save([]);
  },
  /* 상품 정보를 붙인 목록 (판매중지된 상품은 빠짐) */
  lines(items = Cart.get()) {
    return items
      .map(item => {
        const p = findProduct(item.id);
        return p ? { ...item, product: p, unit: salePrice(p), total: salePrice(p) * item.qty } : null;
      })
      .filter(Boolean);
  },
  total(items) {
    return Cart.lines(items).reduce((sum, line) => sum + line.total, 0);
  }
};

/* ===== 회원 장바구니 동기화 ===== */
let pushTimer;
function pushCart() {
  if (!Auth.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const { error } = await sb.rpc('replace_cart', { p_items: Cart.get() });
    if (error) console.error(error);
  }, 300);
}

async function syncCart() {
  const user = await Auth.ready;
  let owner = null;
  try {
    owner = localStorage.getItem(CART_OWNER_KEY);
  } catch (e) {}

  if (!user) {
    // 로그아웃 상태인데 회원 장바구니가 남아 있으면 비움
    if (owner) {
      try {
        localStorage.removeItem(CART_OWNER_KEY);
      } catch (e) {}
      Cart.save([], true);
    }
    return;
  }

  const { data, error } = await sb.from('cart_items').select('product_id, size, qty').order('created_at');
  if (error) return console.error(error);
  const server = data.map(row => ({ id: row.product_id, size: row.size, qty: row.qty }));

  if (owner === user.id) {
    // 이미 동기화된 브라우저: DB가 기준
    Cart.save(server, true);
  } else {
    // 로그인 전에 담은 상품을 회원 장바구니에 합치기
    const merged = server.slice();
    Cart.get().forEach(item => {
      const found = merged.find(m => m.id === item.id && m.size === item.size);
      if (found) found.qty = Math.min(99, Math.max(found.qty, item.qty));
      else merged.push(item);
    });
    try {
      localStorage.setItem(CART_OWNER_KEY, user.id);
    } catch (e) {}
    Cart.save(merged);
  }
  if (document.querySelector('.drawer.is-open')) renderDrawer();
}

/* 바로구매: 장바구니와 별도로 주문 상품을 저장 */
function setOrderItems(items) {
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(items));
  } catch (e) {}
}

function getOrderItems() {
  try {
    const items = JSON.parse(sessionStorage.getItem(ORDER_KEY));
    if (items && items.length) return { items, direct: true };
  } catch (e) {}
  return { items: Cart.get(), direct: false };
}

function updateCartCount() {
  const count = Cart.get().reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count ? '' : 'none';
  });
}

let toastTimer;
function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 2200);
}

/* ===== 장바구니 드로어 ===== */
function renderDrawer() {
  const list = document.querySelector('.drawer__list');
  if (!list) return;
  const lines = Cart.lines();

  if (!lines.length) {
    list.innerHTML = '<p class="empty">장바구니에 담긴 상품이 없습니다.</p>';
  } else {
    list.innerHTML = lines
      .map((line, i) => {
        const left = stockOf(line.product, line.size);
        const warn = left < line.qty ? ` <em class="warn">${left ? `재고 ${left}개 남음` : '품절'}</em>` : '';
        return `
      <div class="line">
        <div class="line__thumb"><img src="${productImage(line.product.category, line.product.color)}" alt=""></div>
        <div class="line__info">
          <p class="line__brand">${esc(line.product.brand)}</p>
          <p class="line__name">${esc(line.product.name)}</p>
          <p class="line__opt">사이즈 ${esc(line.size)}${warn}</p>
          <div class="line__bottom">
            <div class="qty">
              <button type="button" data-qty="${i}" data-step="-1" aria-label="수량 빼기">−</button>
              <input type="text" value="${line.qty}" readonly aria-label="수량">
              <button type="button" data-qty="${i}" data-step="1" aria-label="수량 더하기">+</button>
            </div>
            <span class="line__price">${won(line.total)}</span>
          </div>
          <button type="button" class="line__del" data-del="${i}">삭제</button>
        </div>
      </div>`;
      })
      .join('');
  }

  document.querySelector('.drawer__total').textContent = won(Cart.total());
  document.querySelector('.drawer__order').disabled = !lines.length;
}

async function openDrawer() {
  document.querySelector('.drawer').classList.add('is-open');
  document.querySelector('.dim').classList.add('is-open');
  try {
    await Catalog.load();
  } catch (e) {
    toast('상품 정보를 불러오지 못했습니다.');
  }
  renderDrawer();
}

function closeLayers() {
  document.querySelectorAll('.drawer, .modal, .dim').forEach(el => el.classList.remove('is-open'));
}

/* 회원 장바구니 동기화가 끝나면 풀리는 Promise (결제 완료 후 비우기 전에 기다림) */
Cart.synced = new Promise(resolve => {
  document.addEventListener('DOMContentLoaded', () => resolve(syncCart().catch(console.error)));
});

document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();

  document.addEventListener('click', e => {
    if (e.target.closest('.cart-btn')) {
      e.preventDefault();
      openDrawer();
    }
    if (e.target.closest('.drawer__close, .modal__close') || e.target.classList.contains('dim')) {
      closeLayers();
    }

    // 드로어 안의 수량 버튼 (data-qty 에 장바구니 순서가 들어 있음)
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const i = Number(qtyBtn.dataset.qty);
      const item = Cart.lines()[i];
      if (!item) return;
      const step = Number(qtyBtn.dataset.step);
      const left = stockOf(item.product, item.size);
      if (step > 0 && item.qty + step > left) return toast(`남은 재고는 ${left}개입니다.`);
      Cart.setQty(Cart.get().findIndex(x => x.id === item.id && x.size === item.size), item.qty + step);
      renderDrawer();
    }

    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      const item = Cart.lines()[Number(delBtn.dataset.del)];
      if (item) Cart.remove(Cart.get().findIndex(x => x.id === item.id && x.size === item.size));
      renderDrawer();
    }

    if (e.target.closest('.drawer__order')) {
      setOrderItems([]);
      location.href = 'checkout.html';
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLayers();
  });
});
