/* 주문서 + 토스페이먼츠 결제위젯 연동 */

// 토스페이먼츠 문서용 테스트 클라이언트 키 (결제위젯용)
// 실제 연동 시 개발자센터(https://developers.tosspayments.com)의 내 결제위젯 클라이언트 키로 바꾸세요.
const TOSS_CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

(async function () {
  const { items, direct } = getOrderItems();
  const payBtn = document.querySelector('.pay-btn');
  const $ = id => document.getElementById(id);

  try {
    await Promise.all([Catalog.load(), Auth.ready]);
  } catch (err) {
    console.error(err);
    alert('상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  const lines = Cart.lines(items);

  if (!lines.length) {
    alert('주문할 상품이 없습니다.');
    location.href = 'index.html';
    return;
  }

  /* 회원이면 저장된 정보 자동 입력 */
  const member = Auth.user;
  document.querySelectorAll('.member-only').forEach(el => (el.hidden = !member));
  document.querySelectorAll('.guest-only').forEach(el => (el.hidden = !!member));
  if (member) {
    const p = Auth.profile || {};
    $('customerName').value = p.name || '';
    $('customerPhone').value = p.phone || '';
    $('customerEmail').value = p.email || member.email || '';
    $('address').value = p.address || '';
    $('addressDetail').value = p.address_detail || '';
    $('saveAddress').checked = !p.address;
  }

  /* 주문 상품 목록 */
  document.querySelector('.order-count').textContent = `(${lines.length})`;
  document.querySelector('.order-list').innerHTML = lines
    .map(line => {
      const left = stockOf(line.product, line.size);
      const warn = left < line.qty ? ` <em class="warn">${left ? `재고 ${left}개 남음` : '품절'}</em>` : '';
      return `
    <div class="line">
      <div class="line__thumb"><img src="${productImage(line.product.category, line.product.color)}" alt=""></div>
      <div class="line__info">
        <p class="line__brand">${esc(line.product.brand)}</p>
        <p class="line__name">${esc(line.product.name)}</p>
        <p class="line__opt">사이즈 ${esc(line.size)} / ${line.qty}개${warn}</p>
        <div class="line__bottom"><span></span><span class="line__price">${won(line.total)}</span></div>
      </div>
    </div>`;
    })
    .join('');

  /* 금액 계산 (화면 표시용. 실제 결제 금액은 서버가 다시 계산) */
  const origin = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const goods = lines.reduce((sum, line) => sum + line.total, 0);
  const delivery = deliveryFee(goods);
  const amount = goods + delivery;

  document.querySelector('.sum-origin').textContent = won(origin);
  document.querySelector('.sum-discount').textContent = '-' + won(origin - goods);
  document.querySelector('.sum-delivery').textContent = delivery ? won(delivery) : '무료';
  document.querySelector('.sum-total').textContent = won(amount);

  /* ===== 토스페이먼츠 결제위젯 ===== */
  if (typeof TossPayments === 'undefined') {
    document.querySelector('#payment-method').innerHTML =
      '<p class="notice" style="padding:0 24px">결제 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.</p>';
    return;
  }

  const tossPayments = TossPayments(TOSS_CLIENT_KEY);
  // 회원은 회원별 고유 키, 비회원은 ANONYMOUS
  const widgets = tossPayments.widgets({ customerKey: member ? member.id : TossPayments.ANONYMOUS });

  try {
    await widgets.setAmount({ currency: 'KRW', value: amount });
    await Promise.all([
      widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
      widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' })
    ]);
    payBtn.disabled = false;
  } catch (err) {
    console.error(err);
    document.querySelector('#payment-method').innerHTML =
      `<p class="notice" style="padding:0 24px">결제 UI를 불러오지 못했습니다. (${esc(err.message || err)})</p>`;
    return;
  }

  payBtn.addEventListener('click', async () => {
    const customer = {
      name: $('customerName').value.trim(),
      phone: $('customerPhone').value.replace(/\D/g, ''),
      email: $('customerEmail').value.trim(),
      address: $('address').value.trim(),
      addressDetail: $('addressDetail').value.trim(),
      memo: $('memo').value.trim()
    };

    if (!customer.name) return toast('이름을 입력해 주세요.');
    if (!/^01\d{8,9}$/.test(customer.phone)) return toast('휴대폰 번호를 확인해 주세요.');
    if (!customer.address) return toast('배송 주소를 입력해 주세요.');

    payBtn.disabled = true;

    // 서버에 주문 생성 → 서버가 DB 가격과 재고로 계산한 금액으로만 결제 (금액 위변조 방지)
    let order;
    try {
      order = await api('/api/orders', { items, customer });
      if (order.amount !== amount) {
        await widgets.setAmount({ currency: 'KRW', value: order.amount });
        document.querySelector('.sum-total').textContent = won(order.amount);
      }
    } catch (err) {
      payBtn.disabled = false;
      return toast(err.message || '주문을 만들지 못했습니다.');
    }

    // 기본 배송지로 저장
    if (member && $('saveAddress').checked) {
      const { error } = await sb
        .from('profiles')
        .update({
          address: customer.address,
          address_detail: customer.addressDetail,
          phone: customer.phone,
          name: (Auth.profile && Auth.profile.name) || customer.name
        })
        .eq('id', member.id);
      if (error) console.error(error);
    }

    try {
      sessionStorage.setItem('outfit_pending', JSON.stringify({ orderId: order.orderId, direct }));
    } catch (e) {}

    const base = location.href.replace(/[^/?#]*([?#].*)?$/, '');
    try {
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        customerName: customer.name,
        customerMobilePhone: customer.phone,
        customerEmail: customer.email || undefined,
        successUrl: base + 'success.html',
        failUrl: base + 'fail.html'
      });
    } catch (err) {
      // 사용자가 결제창을 닫은 경우 등: 실패 사유를 주문에 기록
      payBtn.disabled = false;
      const message = err.code === 'USER_CANCEL' ? '고객이 결제를 취소했습니다.' : err.message || '결제가 취소되었습니다.';
      api(`/api/orders/${order.orderId}/fail`, { code: err.code || 'PAY_PROCESS_CANCELED', message }).catch(() => {});
      toast(message);
    }
  });
})();
