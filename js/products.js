/*
  공통 데이터 / 가격 계산 (브라우저와 server.js가 같이 사용)
  상품 목록과 재고는 DB(Supabase)에 있습니다. 화면에서는 js/db.js 의 Catalog 로 불러옵니다.
*/

/* 새 상품을 등록할 때 쓰는 카테고리별 기본 사이즈 */
const SIZES = {
  top: ['S', 'M', 'L', 'XL', 'XXL'],
  shoes: ['240', '250', '260', '270', '280', '290'],
  pants: ['28', '30', '32', '34', '36']
};

/* 상품 이미지 대신 쓰는 SVG 플레이스홀더 */
const SHAPES = {
  top: 'M70 40 L100 28 Q120 44 140 28 L170 40 L196 78 L170 92 L164 84 L164 200 L76 200 L76 84 L70 92 L44 78 Z',
  shoes: 'M30 150 Q34 118 58 112 L96 100 Q112 96 120 108 Q150 128 196 132 Q214 136 212 160 L212 168 L30 168 Z',
  pants: 'M76 30 L164 30 L172 210 L134 210 L120 92 L106 210 L68 210 Z'
};

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function productImage(category, color) {
  const bg = isDark(color) ? '#e9e9e9' : '#f4f4f4';
  const stroke = isDark(color) ? 'none' : '#d0d0d0';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 288">` +
    `<rect width="240" height="288" fill="${bg}"/>` +
    `<g transform="translate(0 30)"><path d="${SHAPES[category]}" fill="${color}" stroke="${stroke}" stroke-width="2"/></g>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function salePrice(p) {
  return Math.round((p.price * (100 - p.sale)) / 100 / 100) * 100;
}

function won(n) {
  return n.toLocaleString('ko-KR') + '원';
}

const FREE_DELIVERY = 50000;
const DELIVERY_FEE = 3000;

/* 5만원 이상 무료배송, 미만 3,000원 */
function deliveryFee(goods) {
  return goods >= FREE_DELIVERY ? 0 : DELIVERY_FEE;
}

const CATEGORY_LABEL = { top: '상의', shoes: '신발', pants: '바지' };

const ORDER_STATUS = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  PREPARING: '배송 준비',
  SHIPPING: '배송 중',
  DELIVERED: '배송 완료',
  CANCELED: '취소',
  FAILED: '결제 실패'
};
