/* 장바구니 (localStorage) + 공통 UI */
const CART_KEY = 'outfit_cart';
const ORDER_KEY = 'outfit_order';

const Cart = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  },
  save(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (e) {}
    updateCartCount();
  },
  add(id, size, qty) {
    const items = Cart.get();
    const found = items.find(item => item.id === id && item.size === size);
    if (found) found.qty += qty;
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
  /* 상품 정보를 붙인 목록 */
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
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 1800);
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
      .map(
        (line, i) => `
      <div class="line">
        <div class="line__thumb"><img src="${productImage(line.product.category, line.product.color)}" alt=""></div>
        <div class="line__info">
          <p class="line__brand">${line.product.brand}</p>
          <p class="line__name">${line.product.name}</p>
          <p class="line__opt">사이즈 ${line.size}</p>
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
      </div>`
      )
      .join('');
  }

  document.querySelector('.drawer__total').textContent = won(Cart.total());
  document.querySelector('.drawer__order').disabled = !lines.length;
}

function openDrawer() {
  renderDrawer();
  document.querySelector('.drawer').classList.add('is-open');
  document.querySelector('.dim').classList.add('is-open');
}

function closeLayers() {
  document.querySelectorAll('.drawer, .modal, .dim').forEach(el => el.classList.remove('is-open'));
}

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

    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const i = Number(qtyBtn.dataset.qty);
      Cart.setQty(i, Cart.get()[i].qty + Number(qtyBtn.dataset.step));
      renderDrawer();
    }

    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      Cart.remove(Number(delBtn.dataset.del));
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
