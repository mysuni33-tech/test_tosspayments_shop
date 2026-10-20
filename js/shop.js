/* 상품 목록 페이지 (상의 / 신발 / 바지) */
(function () {
  const category = document.body.dataset.category;
  const all = PRODUCTS[category];
  const state = { sub: '전체', sort: 'rank', keyword: '' };

  const grid = document.querySelector('.grid');
  const chips = document.querySelector('.chips');
  const sort = document.querySelector('.sort');
  const search = document.querySelector('.search input');
  const countEl = document.querySelector('.list-count');

  /* 세부 카테고리 칩 */
  const subs = ['전체', ...new Set(all.map(p => p.sub))];
  chips.innerHTML = subs
    .map(s => `<button type="button" class="chip${s === state.sub ? ' is-active' : ''}" data-sub="${s}">${s}</button>`)
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
      <li class="card" data-id="${p.id}">
        <div class="card__thumb">
          <img src="${productImage(category, p.color)}" alt="${p.brand} ${p.name}" loading="lazy">
          ${state.sort === 'rank' ? `<span class="card__rank">${p.rank}</span>` : ''}
          <button type="button" class="card__like" aria-label="좋아요">♥</button>
        </div>
        <div class="card__info">
          <p class="card__brand">${p.brand}</p>
          <p class="card__name">${p.name}</p>
          <p class="card__price">
            ${p.sale ? `<span class="card__sale">${p.sale}%</span>` : ''}
            <span class="card__amount">${won(salePrice(p))}</span>
          </p>
          <p class="card__meta"><b>★</b> ${p.rating} · 후기 ${p.reviews.toLocaleString('ko-KR')}</p>
          ${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
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

  grid.addEventListener('click', e => {
    const like = e.target.closest('.card__like');
    if (like) {
      like.classList.toggle('is-on');
      toast(like.classList.contains('is-on') ? '좋아요한 상품에 추가했습니다.' : '좋아요를 취소했습니다.');
      return;
    }
    const card = e.target.closest('.card');
    if (card) openModal(card.dataset.id);
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
    size = null;
    qty = 1;
    modal.querySelector('.modal__thumb img').src = productImage(category, current.color);
    modal.querySelector('.modal__thumb img').alt = current.brand + ' ' + current.name;
    modal.querySelector('.modal__brand').textContent = current.brand;
    modal.querySelector('.modal__name').textContent = current.name;
    modal.querySelector('.modal__price').innerHTML =
      (current.sale ? `<del>${won(current.price)}</del><span class="card__sale">${current.sale}%</span>` : '') +
      `<span class="card__amount">${won(salePrice(current))}</span>`;
    modal.querySelector('.sizes').innerHTML = SIZES[category]
      .map(s => `<button type="button" class="size" data-size="${s}">${s}</button>`)
      .join('');
    updateTotal();
    modal.classList.add('is-open');
    document.querySelector('.dim').classList.add('is-open');
  }

  modal.addEventListener('click', e => {
    const sizeBtn = e.target.closest('.size');
    if (sizeBtn) {
      size = sizeBtn.dataset.size;
      modal.querySelectorAll('.size').forEach(b => b.classList.toggle('is-active', b === sizeBtn));
    }

    const step = e.target.closest('[data-step]');
    if (step) {
      qty = Math.max(1, Math.min(99, qty + Number(step.dataset.step)));
      updateTotal();
    }

    const action = e.target.closest('[data-action]');
    if (action) {
      if (!size) {
        toast('사이즈를 선택해 주세요.');
        return;
      }
      if (action.dataset.action === 'cart') {
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
})();
