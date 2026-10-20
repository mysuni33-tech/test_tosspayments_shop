/* 상품 목록 페이지 (상의 / 신발 / 바지) */
(async function () {
  const category = document.body.dataset.category;
  const state = { sub: '전체', sort: 'rank', keyword: '' };
  const liked = new Set();

  const grid = document.querySelector('.grid');
  const chips = document.querySelector('.chips');
  const sort = document.querySelector('.sort');
  const search = document.querySelector('.search input');
  const countEl = document.querySelector('.list-count');

  grid.innerHTML = '<p class="empty">상품을 불러오는 중입니다…</p>';
  let all;
  try {
    await Catalog.load();
    all = Catalog.byCategory(category);
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="empty">상품을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';
    return;
  }

  /* 세부 카테고리 칩 */
  const subs = ['전체', ...new Set(all.map(p => p.sub).filter(Boolean))];
  chips.innerHTML = subs
    .map(s => `<button type="button" class="chip${s === state.sub ? ' is-active' : ''}" data-sub="${esc(s)}">${esc(s)}</button>`)
    .join('');

  function filtered() {
    let list = all.map((p, i) => ({ ...p, rank: i + 1 }));
    if (state.sub !== '전체') list = list.filter(p => p.sub === state.sub);
    if (state.keyword) {
      const k = state.keyword.toLowerCase();
      list = list.filter(p => (p.brand + ' ' + p.name).toLowerCase().includes(k));
    }
    const sorters = {
      rank: (a, b) => a.rank - b.rank,
      low: (a, b) => salePrice(a) - salePrice(b),
      high: (a, b) => salePrice(b) - salePrice(a),
      sale: (a, b) => b.sale - a.sale,
      review: (a, b) => b.reviews - a.reviews
    };
    return list.sort(sorters[state.sort]);
  }

  function render() {
    const list = filtered();
    countEl.textContent = list.length;
    if (!list.length) {
      grid.innerHTML = '<p class="empty">검색 결과가 없습니다.</p>';
      return;
    }
    grid.innerHTML = list
      .map(
        p => `
      <li class="card${p.soldOut ? ' is-soldout' : ''}" data-id="${esc(p.id)}">
        <div class="card__thumb">
          <img src="${productImage(category, p.color)}" alt="${esc(p.brand + ' ' + p.name)}" loading="lazy">
          ${state.sort === 'rank' ? `<span class="card__rank">${p.rank}</span>` : ''}
          ${p.soldOut ? '<span class="card__soldout">품절</span>' : ''}
          <button type="button" class="card__like${liked.has(p.id) ? ' is-on' : ''}" aria-label="찜하기" aria-pressed="${liked.has(p.id)}">♥</button>
        </div>
        <div class="card__info">
          <p class="card__brand">${esc(p.brand)}</p>
          <p class="card__name">${esc(p.name)}</p>
          <p class="card__price">
            ${p.sale ? `<span class="card__sale">${p.sale}%</span>` : ''}
            <span class="card__amount">${won(salePrice(p))}</span>
          </p>
          <p class="card__meta"><b>★</b> ${p.rating} · 후기 ${p.reviews.toLocaleString('ko-KR')}</p>
          ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}
        </div>
      </li>`
      )
      .join('');
  }

  chips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.sub = chip.dataset.sub;
    chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === chip));
    render();
  });

  sort.addEventListener('change', () => {
    state.sort = sort.value;
    render();
  });

  search.addEventListener('input', () => {
    state.keyword = search.value.trim();
    render();
  });

  /* ===== 찜하기 ===== */
  async function toggleLike(button, id) {
    if (!Auth.user) {
      toast('로그인 후 이용할 수 있습니다.');
      return;
    }
    const on = !liked.has(id);
    const { error } = on
      ? await sb.from('wishlists').insert({ product_id: id })
      : await sb.from('wishlists').delete().eq('product_id', id);
    if (error && error.code !== '23505') {
      console.error(error);
      return toast('잠시 후 다시 시도해 주세요.');
    }
    on ? liked.add(id) : liked.delete(id);
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', on);
    toast(on ? '찜 목록에 추가했습니다.' : '찜을 취소했습니다.');
  }

  grid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const like = e.target.closest('.card__like');
    if (like) return toggleLike(like, card.dataset.id);
    openModal(card.dataset.id);
  });

  /* ===== 상품 상세 모달 ===== */
  const modal = document.querySelector('.modal');
  let current = null;
  let size = null;
  let qty = 1;

  function updateTotal() {
    modal.querySelector('.qty input').value = qty;
    modal.querySelector('.modal__total strong').textContent = won(salePrice(current) * qty);
  }

  function openModal(id) {
    current = findProduct(id);
    if (!current) return;
    size = null;
    qty = 1;
    modal.querySelector('.modal__thumb img').src = productImage(category, current.color);
    modal.querySelector('.modal__thumb img').alt = current.brand + ' ' + current.name;
    modal.querySelector('.modal__brand').textContent = current.brand;
    modal.querySelector('.modal__name').textContent = current.name;
    modal.querySelector('.modal__price').innerHTML =
      (current.sale ? `<del>${won(current.price)}</del><span class="card__sale">${current.sale}%</span>` : '') +
      `<span class="card__amount">${won(salePrice(current))}</span>`;
    modal.querySelector('.sizes').innerHTML = current.stock
      .map(s =>
        s.stock > 0
          ? `<button type="button" class="size" data-size="${esc(s.size)}">${esc(s.size)}${s.stock <= 3 ? `<small>${s.stock}개 남음</small>` : ''}</button>`
          : `<button type="button" class="size is-soldout" disabled>${esc(s.size)}<small>품절</small></button>`
      )
      .join('');
    modal.querySelectorAll('[data-action]').forEach(b => (b.disabled = current.soldOut));
    updateTotal();
    modal.classList.add('is-open');
    document.querySelector('.dim').classList.add('is-open');
    loadReviews(current.id);
  }

  /* ===== 리뷰 ===== */
  async function loadReviews(productId) {
    const box = modal.querySelector('.reviews');
    box.innerHTML = '<p class="reviews__empty">리뷰를 불러오는 중입니다…</p>';
    const { data, error } = await sb
      .from('reviews')
      .select('rating, content, author_name, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!current || current.id !== productId) return;
    if (error) {
      box.innerHTML = '<p class="reviews__empty">리뷰를 불러오지 못했습니다.</p>';
      return;
    }
    if (!data.length) {
      box.innerHTML = '<p class="reviews__title">리뷰 <span>0</span></p><p class="reviews__empty">아직 작성된 리뷰가 없습니다.</p>';
      return;
    }
    const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
    box.innerHTML =
      `<p class="reviews__title">리뷰 <span>${data.length}</span> <b>★ ${avg.toFixed(1)}</b></p>` +
      data
        .map(
          r => `
        <div class="review">
          <p class="review__head"><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            <span>${esc(r.author_name)} · ${formatDate(r.created_at)}</span></p>
          <p class="review__body">${esc(r.content)}</p>
        </div>`
        )
        .join('');
  }

  modal.addEventListener('click', e => {
    const sizeBtn = e.target.closest('.size');
    if (sizeBtn && !sizeBtn.disabled) {
      size = sizeBtn.dataset.size;
      modal.querySelectorAll('.size').forEach(b => b.classList.toggle('is-active', b === sizeBtn));
      qty = Math.min(qty, stockOf(current, size));
      updateTotal();
    }

    const step = e.target.closest('[data-step]');
    if (step) {
      const next = qty + Number(step.dataset.step);
      if (size && next > stockOf(current, size)) {
        toast(`남은 재고는 ${stockOf(current, size)}개입니다.`);
        return;
      }
      qty = Math.max(1, Math.min(99, next));
      updateTotal();
    }

    const action = e.target.closest('[data-action]');
    if (action) {
      if (!size) {
        toast('사이즈를 선택해 주세요.');
        return;
      }
      if (action.dataset.action === 'cart') {
        const inCart = Cart.get().find(item => item.id === current.id && item.size === size);
        const left = stockOf(current, size);
        if ((inCart ? inCart.qty : 0) + qty > left) {
          toast(`장바구니에 이미 담긴 수량을 포함해 ${left}개까지 담을 수 있습니다.`);
          return;
        }
        Cart.add(current.id, size, qty);
        closeLayers();
        toast('장바구니에 담았습니다.');
      } else {
        setOrderItems([{ id: current.id, size, qty }]);
        location.href = 'checkout.html';
      }
    }
  });

  render();

  /* 로그인한 회원의 찜 목록 표시 */
  if (await Auth.ready) {
    const { data } = await sb.from('wishlists').select('product_id');
    (data || []).forEach(row => liked.add(row.product_id));
    grid.querySelectorAll('.card').forEach(card => {
      const on = liked.has(card.dataset.id);
      const btn = card.querySelector('.card__like');
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on);
    });
  }
})();
