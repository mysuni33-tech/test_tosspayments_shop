/* 마이페이지: 주문 내역 · 찜 목록 · 내 정보 */
(async function () {
  if (!(await Auth.require())) return;
  const me = Auth.user;
  const $ = id => document.getElementById(id);
  const CATEGORY_PAGE = { top: 'index.html', shoes: 'shoes.html', pants: 'pants.html' };
  const REVIEWABLE = ['PAID', 'PREPARING', 'SHIPPING', 'DELIVERED'];
  const CANCELABLE = ['PAID', 'PREPARING'];

  document.querySelector('.hello').textContent = `${(Auth.profile && Auth.profile.name) || me.email}님`;

  /* ===== 탭 ===== */
  const loaders = { orders: loadOrders, wish: loadWish, info: loadInfo };
  function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach(p => (p.hidden = p.dataset.panel !== name));
    loaders[name]();
  }
  document.querySelector('.tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (tab) showTab(tab.dataset.tab);
  });

  /* ===== 주문 내역 ===== */
  const rowsEl = document.querySelector('.order-rows');
  const detailEl = document.querySelector('.order-detail');

  const statusBadge = status => `<span class="badge badge--${status.toLowerCase()}">${ORDER_STATUS[status] || status}</span>`;

  async function loadOrders() {
    detailEl.hidden = true;
    rowsEl.hidden = false;
    rowsEl.innerHTML = '<p class="empty">불러오는 중입니다…</p>';
    // 결제 대기·실패 주문은 목록에서 빠짐
    const { data, error } = await sb
      .from('orders')
      .select('id, status, order_name, amount, created_at, order_items(category, color, qty)')
      .not('status', 'in', '(PENDING,FAILED)')
      .order('created_at', { ascending: false });
    if (error) {
      rowsEl.innerHTML = '<p class="empty">주문 내역을 불러오지 못했습니다.</p>';
      return;
    }
    if (!data.length) {
      rowsEl.innerHTML = '<p class="empty">주문 내역이 없습니다.</p>';
      return;
    }
    rowsEl.innerHTML = data
      .map(o => {
        const first = o.order_items[0];
        return `
      <button type="button" class="order-row" data-order="${esc(o.id)}">
        <span class="order-row__thumb">${first ? `<img src="${productImage(first.category, first.color)}" alt="">` : ''}</span>
        <span class="order-row__info">
          <span class="order-row__date">${formatDate(o.created_at)} · ${esc(o.id)}</span>
          <strong class="order-row__name">${esc(o.order_name)}</strong>
          <span class="order-row__amount">${won(o.amount)}</span>
        </span>
        ${statusBadge(o.status)}
      </button>`;
      })
      .join('');
  }

  rowsEl.addEventListener('click', e => {
    const row = e.target.closest('[data-order]');
    if (row) openOrder(row.dataset.order);
  });

  let currentOrder = null;
  let myReviews = [];

  async function openOrder(orderId) {
    const [{ data: order, error }, reviews] = await Promise.all([
      sb.from('orders').select('*, order_items(*)').eq('id', orderId).maybeSingle(),
      sb.from('reviews').select('id, product_id, rating, content').eq('user_id', me.id)
    ]);
    if (error || !order) return toast('주문 정보를 불러오지 못했습니다.');
    currentOrder = order;
    myReviews = reviews.data || [];
    renderOrder();
    rowsEl.hidden = true;
    detailEl.hidden = false;
    window.scrollTo(0, 0);
  }

  function renderOrder() {
    const o = currentOrder;
    const canReview = REVIEWABLE.includes(o.status);
    detailEl.innerHTML = `
      <button type="button" class="link back-btn">← 주문 목록</button>
      <div class="detail-head">
        <div>
          <p class="detail-head__date">${formatDate(o.created_at, true)}</p>
          <h3>${esc(o.id)}</h3>
        </div>
        ${statusBadge(o.status)}
      </div>

      <h4 class="box__title">주문 상품</h4>
      ${o.order_items
        .map(item => {
          const review = myReviews.find(r => r.product_id === item.product_id);
          let reviewUi = '';
          if (review) {
            reviewUi = `<div class="my-review"><span class="stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span> ${esc(review.content)}
              <button type="button" class="link" data-del-review="${review.id}">리뷰 삭제</button></div>`;
          } else if (canReview) {
            reviewUi = `<button type="button" class="btn btn--small" data-write-review="${esc(item.product_id)}">리뷰 쓰기</button>`;
          }
          return `
        <div class="line">
          <div class="line__thumb"><img src="${productImage(item.category, item.color)}" alt=""></div>
          <div class="line__info">
            <p class="line__brand">${esc(item.brand)}</p>
            <p class="line__name">${esc(item.name)}</p>
            <p class="line__opt">사이즈 ${esc(item.size)} / ${item.qty}개</p>
            <div class="line__bottom"><span></span><span class="line__price">${won(item.total)}</span></div>
            ${reviewUi}
            <div class="review-form-slot" data-slot="${esc(item.product_id)}"></div>
          </div>
        </div>`;
        })
        .join('')}

      <h4 class="box__title">결제 정보</h4>
      <dl class="info-list">
        <div><dt>상품 금액</dt><dd>${won(o.goods_amount)}</dd></div>
        <div><dt>배송비</dt><dd>${o.delivery_fee ? won(o.delivery_fee) : '무료'}</dd></div>
        <div><dt>총 결제금액</dt><dd><strong>${won(o.amount)}</strong></dd></div>
        <div><dt>결제 수단</dt><dd>${esc(o.method || '-')}</dd></div>
        <div><dt>승인 일시</dt><dd>${formatDate(o.approved_at, true)}</dd></div>
        ${o.receipt_url ? `<div><dt>영수증</dt><dd><a class="link" href="${esc(o.receipt_url)}" target="_blank" rel="noopener">영수증 보기</a></dd></div>` : ''}
        ${o.status === 'CANCELED' ? `<div><dt>취소 일시</dt><dd>${formatDate(o.canceled_at, true)} (${esc(o.cancel_reason || '')})</dd></div>` : ''}
      </dl>

      <h4 class="box__title">배송지</h4>
      <dl class="info-list">
        <div><dt>받는 분</dt><dd>${esc(o.customer_name)} · ${esc(o.customer_phone)}</dd></div>
        <div><dt>주소</dt><dd>${esc(o.address)} ${esc(o.address_detail)}</dd></div>
        <div><dt>배송 메모</dt><dd>${esc(o.delivery_memo || '-')}</dd></div>
      </dl>

      ${CANCELABLE.includes(o.status) ? '<button type="button" class="btn cancel-btn">주문 취소</button>' : ''}
    `;
  }

  detailEl.addEventListener('click', async e => {
    if (e.target.closest('.back-btn')) return loadOrders();

    if (e.target.closest('.cancel-btn')) {
      if (!confirm('주문을 취소할까요? 결제도 함께 취소됩니다.')) return;
      const btn = e.target.closest('.cancel-btn');
      btn.disabled = true;
      try {
        await api(`/api/orders/${currentOrder.id}/cancel`, { reason: '고객 요청 취소' });
        toast('주문을 취소했습니다.');
        openOrder(currentOrder.id);
      } catch (err) {
        btn.disabled = false;
        toast(err.message);
      }
      return;
    }

    const write = e.target.closest('[data-write-review]');
    if (write) {
      const slot = detailEl.querySelector(`[data-slot="${CSS.escape(write.dataset.writeReview)}"]`);
      write.hidden = true;
      slot.innerHTML = `
        <form class="review-form" data-product="${esc(write.dataset.writeReview)}">
          <div class="star-pick" role="radiogroup" aria-label="별점">
            ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" aria-label="${n}점">★</button>`).join('')}
          </div>
          <textarea maxlength="1000" placeholder="상품은 어떠셨나요? 다른 고객에게 도움이 되는 후기를 남겨 주세요."></textarea>
          <button type="submit" class="btn btn--black btn--small">등록하기</button>
        </form>`;
      slot.querySelector('.review-form').dataset.rating = 5;
      paintStars(slot.querySelector('.review-form'));
      return;
    }

    const star = e.target.closest('[data-star]');
    if (star) {
      const form = star.closest('.review-form');
      form.dataset.rating = star.dataset.star;
      paintStars(form);
      return;
    }

    const del = e.target.closest('[data-del-review]');
    if (del) {
      if (!confirm('리뷰를 삭제할까요?')) return;
      const { error } = await sb.from('reviews').delete().eq('id', del.dataset.delReview);
      if (error) return toast('리뷰를 삭제하지 못했습니다.');
      toast('리뷰를 삭제했습니다.');
      openOrder(currentOrder.id);
    }
  });

  function paintStars(form) {
    form.querySelectorAll('[data-star]').forEach(b => b.classList.toggle('is-on', Number(b.dataset.star) <= Number(form.dataset.rating)));
  }

  detailEl.addEventListener('submit', async e => {
    const form = e.target.closest('.review-form');
    if (!form) return;
    e.preventDefault();
    const content = form.querySelector('textarea').value.trim();
    if (!content) return toast('후기 내용을 입력해 주세요.');
    const { error } = await sb.from('reviews').insert({
      product_id: form.dataset.product,
      rating: Number(form.dataset.rating),
      content
    });
    if (error) {
      console.error(error);
      return toast(error.code === '23505' ? '이미 이 상품의 리뷰를 작성했습니다.' : '리뷰를 등록하지 못했습니다.');
    }
    toast('리뷰를 등록했습니다.');
    openOrder(currentOrder.id);
  });

  /* ===== 찜 목록 ===== */
  const wishGrid = document.querySelector('.wish-grid');

  async function loadWish() {
    wishGrid.innerHTML = '<p class="empty">불러오는 중입니다…</p>';
    const { data, error } = await sb
      .from('wishlists')
      .select('product_id, created_at, products(*, product_stock(size, stock, sort))')
      .order('created_at', { ascending: false });
    if (error) {
      wishGrid.innerHTML = '<p class="empty">찜 목록을 불러오지 못했습니다.</p>';
      return;
    }
    const list = data.filter(row => row.products).map(row => normalizeProduct(row.products));
    if (!list.length) {
      wishGrid.innerHTML = '<p class="empty">찜한 상품이 없습니다. 상품 카드의 ♥를 눌러 보세요.</p>';
      return;
    }
    wishGrid.innerHTML = list
      .map(
        p => `
      <li class="card${p.soldOut ? ' is-soldout' : ''}" data-id="${esc(p.id)}">
        <a href="${CATEGORY_PAGE[p.category]}" class="card__thumb">
          <img src="${productImage(p.category, p.color)}" alt="${esc(p.brand + ' ' + p.name)}" loading="lazy">
          ${p.soldOut ? '<span class="card__soldout">품절</span>' : ''}
          <button type="button" class="card__like is-on" aria-label="찜 취소" data-unlike="${esc(p.id)}">♥</button>
        </a>
        <div class="card__info">
          <p class="card__brand">${esc(p.brand)}</p>
          <p class="card__name">${esc(p.name)}</p>
          <p class="card__price">
            ${p.sale ? `<span class="card__sale">${p.sale}%</span>` : ''}
            <span class="card__amount">${won(salePrice(p))}</span>
          </p>
        </div>
      </li>`
      )
      .join('');
  }

  wishGrid.addEventListener('click', async e => {
    const btn = e.target.closest('[data-unlike]');
    if (!btn) return;
    e.preventDefault();
    const { error } = await sb.from('wishlists').delete().eq('product_id', btn.dataset.unlike);
    if (error) return toast('잠시 후 다시 시도해 주세요.');
    toast('찜을 취소했습니다.');
    loadWish();
  });

  /* ===== 내 정보 ===== */
  async function loadInfo() {
    const { data } = await sb.from('profiles').select('*').eq('id', me.id).maybeSingle();
    const p = data || {};
    $('infoEmail').value = p.email || me.email;
    $('infoName').value = p.name || '';
    $('infoPhone').value = p.phone || '';
    $('infoAddress').value = p.address || '';
    $('infoAddressDetail').value = p.address_detail || '';
  }

  document.querySelector('.info-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('infoName').value.trim();
    const phone = $('infoPhone').value.replace(/\D/g, '');
    if (!name) return toast('이름을 입력해 주세요.');
    if (phone && !/^01\d{8,9}$/.test(phone)) return toast('연락처를 확인해 주세요.');
    const { error } = await sb
      .from('profiles')
      .update({ name, phone, address: $('infoAddress').value.trim(), address_detail: $('infoAddressDetail').value.trim() })
      .eq('id', me.id);
    if (error) return toast('저장하지 못했습니다.');
    document.querySelector('.hello').textContent = `${name}님`;
    toast('저장했습니다.');
  });

  showTab(new URLSearchParams(location.search).get('tab') || 'orders');
})();
