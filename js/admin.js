/*
  관리자 화면: 주문 관리 · 상품 관리
  화면은 관리자만 열리고, 데이터도 DB 권한(RLS)으로 관리자만 읽고 고칠 수 있습니다.
  배송 상태 변경과 취소(환불)는 서버(/api/...)를 거칩니다.
*/
(async function () {
  if (!(await Auth.require())) return;
  if (!Auth.isAdmin) {
    document.querySelector('.denied').hidden = false;
    return;
  }
  document.querySelector('.admin').hidden = false;

  const modal = document.querySelector('.modal');
  const modalContent = modal.querySelector('.modal__content');
  const NEXT_STATUS = { PAID: 'PREPARING', PREPARING: 'SHIPPING', SHIPPING: 'DELIVERED' };
  const ADMIN_CANCELABLE = ['PAID', 'PREPARING', 'SHIPPING', 'DELIVERED'];
  const ID_PREFIX = { top: 'T', shoes: 'S', pants: 'P' };

  function openPanel(html) {
    modalContent.innerHTML = html;
    modal.classList.add('is-open');
    document.querySelector('.dim').classList.add('is-open');
  }

  /* ===== 탭 ===== */
  document.querySelector('.tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t === tab));
    document.querySelectorAll('.panel').forEach(p => (p.hidden = p.dataset.panel !== tab.dataset.tab));
    tab.dataset.tab === 'orders' ? loadOrders() : loadProducts();
  });

  const statusBadge = status => `<span class="badge badge--${status.toLowerCase()}">${ORDER_STATUS[status] || status}</span>`;

  /* ===== 주문 관리 ===== */
  let statusFilter = 'ALL';
  let orders = [];
  const statusChips = document.querySelector('.status-chips');
  statusChips.innerHTML = [['ALL', '전체'], ...Object.entries(ORDER_STATUS)]
    .map(([key, label]) => `<button type="button" class="chip${key === statusFilter ? ' is-active' : ''}" data-status="${key}">${label}</button>`)
    .join('');
  statusChips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    statusFilter = chip.dataset.status;
    statusChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === chip));
    loadOrders();
  });
  document.querySelector('.reload-orders').addEventListener('click', () => loadOrders());

  const orderTbody = document.querySelector('.order-tbody');

  async function loadOrders() {
    orderTbody.innerHTML = '<tr><td colspan="7" class="empty">불러오는 중입니다…</td></tr>';
    let query = sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(200);
    if (statusFilter !== 'ALL') query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) {
      orderTbody.innerHTML = '<tr><td colspan="7" class="empty">주문을 불러오지 못했습니다.</td></tr>';
      return;
    }
    orders = data;
    if (!orders.length) {
      orderTbody.innerHTML = '<tr><td colspan="7" class="empty">주문이 없습니다.</td></tr>';
      return;
    }
    orderTbody.innerHTML = orders
      .map(
        o => `
      <tr data-order="${esc(o.id)}" class="is-click">
        <td>${formatDate(o.created_at, true)}</td>
        <td class="mono">${esc(o.id)}</td>
        <td>${esc(o.customer_name)}${o.user_id ? '' : ' <small class="muted">(비회원)</small>'}</td>
        <td>${esc(o.order_name)}</td>
        <td class="num">${won(o.amount)}</td>
        <td>${esc(o.method || '-')}</td>
        <td>${statusBadge(o.status)}${o.status === 'FAILED' && o.fail_message ? `<small class="muted block">${esc(o.fail_message)}</small>` : ''}</td>
      </tr>`
      )
      .join('');
  }

  orderTbody.addEventListener('click', e => {
    const row = e.target.closest('[data-order]');
    if (row) openOrder(orders.find(o => o.id === row.dataset.order));
  });

  function openOrder(o) {
    const next = NEXT_STATUS[o.status];
    openPanel(`
      <h3 class="panel-title">주문 상세 ${statusBadge(o.status)}</h3>
      <p class="mono muted">${esc(o.id)}</p>

      <h4 class="box__title">주문 상품</h4>
      <table class="table table--compact">
        <tbody>
          ${o.order_items
            .map(i => `<tr><td>${esc(i.brand)} ${esc(i.name)}</td><td>${esc(i.size)}</td><td>${i.qty}개</td><td class="num">${won(i.total)}</td></tr>`)
            .join('')}
        </tbody>
      </table>

      <h4 class="box__title">결제</h4>
      <dl class="info-list">
        <div><dt>결제금액</dt><dd><strong>${won(o.amount)}</strong> (배송비 ${won(o.delivery_fee)})</dd></div>
        <div><dt>결제수단</dt><dd>${esc(o.method || '-')}</dd></div>
        <div><dt>승인일시</dt><dd>${formatDate(o.approved_at, true)}</dd></div>
        ${o.receipt_url ? `<div><dt>영수증</dt><dd><a class="link" href="${esc(o.receipt_url)}" target="_blank" rel="noopener">영수증 보기</a></dd></div>` : ''}
        ${o.status === 'FAILED' ? `<div><dt>실패 사유</dt><dd>${esc(o.fail_message || '-')} <small class="muted">(${esc(o.fail_code || '')})</small></dd></div>` : ''}
        ${o.status === 'CANCELED' ? `<div><dt>취소</dt><dd>${formatDate(o.canceled_at, true)} · ${esc(o.cancel_reason || '')}</dd></div>` : ''}
      </dl>

      <h4 class="box__title">주문자 / 배송지</h4>
      <dl class="info-list">
        <div><dt>주문자</dt><dd>${esc(o.customer_name)} · ${esc(o.customer_phone)} ${o.customer_email ? '· ' + esc(o.customer_email) : ''}</dd></div>
        <div><dt>회원 여부</dt><dd>${o.user_id ? '회원' : '비회원'}</dd></div>
        <div><dt>주소</dt><dd>${esc(o.address)} ${esc(o.address_detail)}</dd></div>
        <div><dt>배송 메모</dt><dd>${esc(o.delivery_memo || '-')}</dd></div>
      </dl>

      <div class="panel-btns">
        ${next ? `<button type="button" class="btn btn--black" data-next="${next}">${ORDER_STATUS[next]}(으)로 변경</button>` : ''}
        ${ADMIN_CANCELABLE.includes(o.status) ? '<button type="button" class="btn" data-cancel>주문 취소 (환불)</button>' : ''}
      </div>
    `);
    modalContent.dataset.order = o.id;
  }

  /* ===== 상품 관리 ===== */
  let categoryFilter = 'top';
  let products = [];
  const categoryChips = document.querySelector('.category-chips');
  categoryChips.innerHTML = Object.entries(CATEGORY_LABEL)
    .map(([key, label]) => `<button type="button" class="chip${key === categoryFilter ? ' is-active' : ''}" data-category="${key}">${label}</button>`)
    .join('');
  categoryChips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    categoryFilter = chip.dataset.category;
    categoryChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === chip));
    renderProducts();
  });

  const productTbody = document.querySelector('.product-tbody');

  async function loadProducts() {
    productTbody.innerHTML = '<tr><td colspan="8" class="empty">불러오는 중입니다…</td></tr>';
    // 판매중지 상품까지 모두 (관리자 권한)
    const { data, error } = await sb.from('products').select('*, product_stock(size, stock, sort)').order('sort_order');
    if (error) {
      productTbody.innerHTML = '<tr><td colspan="8" class="empty">상품을 불러오지 못했습니다.</td></tr>';
      return;
    }
    products = data.map(normalizeProduct);
    renderProducts();
  }

  function renderProducts() {
    const list = products.filter(p => p.category === categoryFilter);
    productTbody.innerHTML = list
      .map(
        p => `
      <tr class="${p.active ? '' : 'is-off'}">
        <td><img class="thumb" src="${productImage(p.category, p.color)}" alt=""></td>
        <td><b>${esc(p.brand)}</b><br>${esc(p.name)} <small class="muted">${esc(p.id)}</small></td>
        <td class="num">${won(p.price)}</td>
        <td class="num">${p.sale}%</td>
        <td class="num"><b>${won(salePrice(p))}</b></td>
        <td class="stock-cell">${p.stock.map(s => `<span class="${s.stock ? '' : 'is-zero'}">${esc(s.size)} <b>${s.stock}</b></span>`).join('')}${p.soldOut ? ' <em class="warn">품절</em>' : ''}</td>
        <td>${p.active ? '판매중' : '<span class="muted">판매중지</span>'}</td>
        <td><button type="button" class="btn btn--small" data-edit="${esc(p.id)}">수정</button></td>
      </tr>`
      )
      .join('') || '<tr><td colspan="8" class="empty">상품이 없습니다.</td></tr>';
  }

  productTbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-edit]');
    if (btn) openProduct(products.find(p => p.id === btn.dataset.edit));
  });
  document.querySelector('.add-product').addEventListener('click', () => openProduct(null));

  function openProduct(p) {
    const isNew = !p;
    const category = p ? p.category : categoryFilter;
    const sizes = p ? p.stock : SIZES[category].map((size, i) => ({ size, stock: 0, sort: i }));
    openPanel(`
      <h3 class="panel-title">${isNew ? '상품 추가' : '상품 수정'}</h3>
      <form class="product-form" data-id="${p ? esc(p.id) : ''}" novalidate>
        <div class="form-row"><label>카테고리</label>
          <select name="category" ${isNew ? '' : 'disabled'}>
            ${Object.entries(CATEGORY_LABEL).map(([k, v]) => `<option value="${k}"${k === category ? ' selected' : ''}>${v}</option>`).join('')}
          </select></div>
        <div class="form-row"><label>브랜드</label><input name="brand" maxlength="40" value="${p ? esc(p.brand) : ''}"></div>
        <div class="form-row"><label>상품명</label><input name="name" maxlength="80" value="${p ? esc(p.name) : ''}"></div>
        <div class="form-row"><label>세부 분류</label><input name="sub" maxlength="20" placeholder="예: 반팔, 스니커즈" value="${p ? esc(p.sub) : ''}"></div>
        <div class="form-row"><label>정가 (원)</label><input name="price" type="number" min="0" step="100" value="${p ? p.price : ''}"></div>
        <div class="form-row"><label>할인율 (%)</label><input name="sale" type="number" min="0" max="99" value="${p ? p.sale : 0}"></div>
        <div class="form-row"><label>태그</label><input name="tag" maxlength="10" placeholder="예: 신상, 무료배송" value="${p ? esc(p.tag) : ''}"></div>
        <div class="form-row"><label>색상</label><input name="color" type="color" value="${p ? esc(p.color) : '#888888'}"></div>
        <div class="form-row"><label>판매</label>
          <label class="check"><input type="checkbox" name="active" ${!p || p.active ? 'checked' : ''}> 판매중 (끄면 쇼핑 화면에서 사라짐)</label></div>
        <p class="modal__label">사이즈별 재고</p>
        <div class="stock-inputs">
          ${sizes.map(s => `<label><span>${esc(s.size)}</span><input type="number" min="0" max="9999" data-size="${esc(s.size)}" data-sort="${s.sort}" value="${s.stock}"></label>`).join('')}
        </div>
        <p class="notice sale-preview"></p>
        <div class="panel-btns"><button type="submit" class="btn btn--black">저장하기</button></div>
      </form>
    `);
    const form = modalContent.querySelector('.product-form');
    const preview = () => {
      const price = Number(form.price.value) || 0;
      const sale = Number(form.sale.value) || 0;
      form.querySelector('.sale-preview').textContent = `판매가: ${won(salePrice({ price, sale }))}`;
    };
    form.addEventListener('input', preview);
    preview();
  }

  async function saveProduct(form) {
    const id = form.dataset.id;
    const category = form.category.value;
    const values = {
      brand: form.brand.value.trim(),
      name: form.name.value.trim(),
      sub: form.sub.value.trim(),
      price: Math.floor(Number(form.price.value)),
      sale: Math.floor(Number(form.sale.value)),
      tag: form.tag.value.trim(),
      color: form.color.value,
      active: form.active.checked
    };
    if (!values.brand || !values.name) return toast('브랜드와 상품명을 입력해 주세요.');
    if (!(values.price > 0)) return toast('정가를 입력해 주세요.');
    if (!(values.sale >= 0 && values.sale <= 99)) return toast('할인율은 0~99 사이로 입력해 주세요.');
    const stock = [...form.querySelectorAll('[data-size]')].map(input => ({
      size: input.dataset.size,
      sort: Number(input.dataset.sort),
      stock: Math.max(0, Math.floor(Number(input.value) || 0))
    }));

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    let productId = id;
    let error;
    if (id) {
      ({ error } = await sb.from('products').update(values).eq('id', id));
    } else {
      // 새 상품 번호: 카테고리 글자 + 다음 번호 (예: T11)
      const prefix = ID_PREFIX[category];
      const max = products
        .filter(p => p.id.startsWith(prefix))
        .reduce((m, p) => Math.max(m, Number(p.id.slice(1)) || 0), 0);
      productId = prefix + String(max + 1).padStart(2, '0');
      const sortOrder = products.filter(p => p.category === category).reduce((m, p) => Math.max(m, p.sort_order), 0) + 1;
      ({ error } = await sb.from('products').insert({ id: productId, category, sort_order: sortOrder, ...values }));
    }
    if (!error) {
      ({ error } = await sb
        .from('product_stock')
        .upsert(stock.map(s => ({ product_id: productId, ...s })), { onConflict: 'product_id,size' }));
    }
    btn.disabled = false;
    if (error) {
      console.error(error);
      return toast('저장하지 못했습니다. (' + error.message + ')');
    }
    toast('저장했습니다.');
    closeLayers();
    loadProducts();
  }

  /* ===== 창 안의 버튼 ===== */
  modalContent.addEventListener('submit', e => {
    if (e.target.matches('.product-form')) {
      e.preventDefault();
      saveProduct(e.target);
    }
  });

  modalContent.addEventListener('click', async e => {
    const orderId = modalContent.dataset.order;
    const nextBtn = e.target.closest('[data-next]');
    const cancelBtn = e.target.closest('[data-cancel]');
    if (!nextBtn && !cancelBtn) return;

    if (cancelBtn && !confirm('이 주문을 취소하고 결제 금액을 환불할까요?')) return;
    const btn = nextBtn || cancelBtn;
    btn.disabled = true;
    try {
      if (nextBtn) {
        await api(`/api/admin/orders/${orderId}/status`, { status: nextBtn.dataset.next });
        toast(`${ORDER_STATUS[nextBtn.dataset.next]}(으)로 변경했습니다.`);
      } else {
        await api(`/api/orders/${orderId}/cancel`, { reason: '관리자 취소' });
        toast('주문을 취소하고 환불했습니다.');
      }
      await loadOrders();
      const updated = orders.find(o => o.id === orderId);
      if (updated) openOrder(updated);
      else closeLayers();
    } catch (err) {
      btn.disabled = false;
      toast(err.message);
    }
  });

  loadOrders();
})();
