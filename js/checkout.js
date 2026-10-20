/* 주문서 + 토스페이먼츠 결제위젯 연동 */

// 토스페이먼츠 문서용 테스트 클라이언트 키 (결제위젯용)
// 실제 연동 시 개발자센터(https://developers.tosspayments.com)의 내 결제위젯 클라이언트 키로 바꾸세요.
const TOSS_CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

const FREE_DELIVERY = 50000;
const DELIVERY_FEE = 3000;

(async function () {
  const { items, direct } = getOrderItems();
  const lines = Cart.lines(items);
  const payBtn = document.querySelector('.pay-btn');

  if (!lines.length) {
    alert('주문할 상품이 없습니다.');
    location.href = 'index.html';
    return;
  }

  /* 주문 상품 목록 */
  document.querySelector('.order-count').textContent = `(${lines.length})`;
  document.querySelector('.order-list').innerHTML = lines
    .map(
      line => `
    <div class="line">
      <div class="line__thumb"><img src="${productImage(line.product.category, line.product.color)}" alt=""></div>
      <div class="line__info">
        <p class="line__brand">${line.product.brand}</p>
        <p class="line__name">${line.product.name}</p>
        <p class="line__opt">사이즈 ${line.size} / ${line.qty}개</p>
        <div class="line__bottom"><span></span><span class="line__price">${won(line.total)}</span></div>
      </div>
    </div>`
    )
    .join('');

  /* 금액 계산 */
  const origin = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const goods = lines.reduce((sum, line) => sum + line.total, 0);
  const delivery = goods >= FREE_DELIVERY ? 0 : DELIVERY_FEE;
  const amount = goods + delivery;

  document.querySelector('.sum-origin').textContent = won(origin);
  document.querySelector('.sum-discount').textContent = '-' + won(origin - goods);
  document.querySelector('.sum-delivery').textContent = delivery ? won(delivery) : '무료';
  document.querySelector('.sum-total').textContent = won(amount);

  const first = lines[0].product;
  const orderName = lines.length > 1 ? `${first.name} 외 ${lines.length - 1}건` : first.name;

  /* ===== 토스페이먼츠 결제위젯 ===== */
  if (typeof TossPayments === 'undefined') {
    document.querySelector('#payment-method').innerHTML =
      '<p class="notice" style="padding:0 24px">결제 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.</p>';
    return;
  }

  const tossPayments = TossPayments(TOSS_CLIENT_KEY);
  // 비회원 결제: ANONYMOUS / 회원 결제라면 회원별 고유 키를 넣으세요.
  const widgets = tossPayments.widgets({ customerKey: TossPayments.ANONYMOUS });

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
      `<p class="notice" style="padding:0 24px">결제 UI를 불러오지 못했습니다. (${err.message || err})</p>`;
    return;
  }

  payBtn.addEventListener('click', async () => {
    const name = document.querySelector('#customerName').value.trim();
    const phone = document.querySelector('#customerPhone').value.replace(/\D/g, '');
    const email = document.querySelector('#customerEmail').value.trim();

    if (!name) return toast('이름을 입력해 주세요.');
    if (!/^01\d{8,9}$/.test(phone)) return toast('휴대폰 번호를 확인해 주세요.');

    payBtn.disabled = true;

    // 서버에 주문 생성 → 서버가 계산한 금액으로만 결제 (금액 위변조 방지)
    let order;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      order = await res.json();
      if (!res.ok) throw new Error(order.message);
      if (order.amount !== amount) {
        await widgets.setAmount({ currency: 'KRW', value: order.amount });
      }
    } catch (err) {
      payBtn.disabled = false;
      return toast(err.message || '주문을 만들지 못했습니다. 서버(node server.js)가 실행 중인지 확인해 주세요.');
    }

    try {
      sessionStorage.setItem('outfit_pending', JSON.stringify({ orderId: order.orderId, direct }));
    } catch (e) {}

    const base = location.href.replace(/[^/]*$/, '');
    try {
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        customerName: name,
        customerMobilePhone: phone,
        customerEmail: email || undefined,
        successUrl: base + 'success.html',
        failUrl: base + 'fail.html'
      });
    } catch (err) {
      // 사용자가 결제창을 닫은 경우 등
      payBtn.disabled = false;
      toast(err.message || '결제가 취소되었습니다.');
    }
  });
})();
