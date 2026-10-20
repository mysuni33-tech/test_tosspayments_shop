/* 상품 데이터 (퍼블리싱용 더미 데이터) */
const PRODUCTS = {
  top: [
    { id: 'T01', brand: 'COVERNAT', name: '어센틱 로고 반팔 티셔츠 블랙', price: 39000, sale: 30, color: '#1f1f1f', rating: 4.9, reviews: 12840, tag: '무료배송', sub: '반팔' },
    { id: 'T02', brand: 'THISISNEVERTHAT', name: 'T-Logo 후드 스웨트셔츠 그레이', price: 89000, sale: 20, color: '#9a9a9a', rating: 4.8, reviews: 5321, tag: '단독', sub: '후드' },
    { id: 'T03', brand: 'LMC', name: '오버핏 옥스포드 셔츠 스카이블루', price: 69000, sale: 15, color: '#9cc3e6', rating: 4.7, reviews: 2104, tag: '무료배송', sub: '셔츠' },
    { id: 'T04', brand: 'MARDI MERCREDI', name: '플라워 그래픽 맨투맨 크림', price: 79000, sale: 10, color: '#efe6d2', rating: 4.9, reviews: 8932, tag: '', sub: '맨투맨' },
    { id: 'T05', brand: 'KIRSH', name: '빅 체리 루즈핏 반팔티 화이트', price: 45000, sale: 40, color: '#f3f3f3', rating: 4.8, reviews: 15022, tag: '세일', sub: '반팔' },
    { id: 'T06', brand: 'DESCENDANT', name: '헤비웨이트 크루넥 니트 네이비', price: 98000, sale: 25, color: '#2b3a5c', rating: 4.6, reviews: 980, tag: '', sub: '니트' },
    { id: 'T07', brand: 'ROMANTIC CROWN', name: '스트라이프 럭비 셔츠 그린', price: 85000, sale: 0, color: '#3f6b4f', rating: 4.7, reviews: 1460, tag: '신상', sub: '셔츠' },
    { id: 'T08', brand: 'STANDARD', name: '데일리 무지 반팔 티셔츠 3팩', price: 29900, sale: 33, color: '#d8d0c4', rating: 4.9, reviews: 32011, tag: '무료배송', sub: '반팔' },
    { id: 'T09', brand: 'ADER', name: '시그니처 로고 후드 집업 차콜', price: 129000, sale: 18, color: '#3c3c3c', rating: 4.8, reviews: 3320, tag: '', sub: '후드' },
    { id: 'T10', brand: 'NOMANUAL', name: '피그먼트 워싱 맨투맨 버건디', price: 72000, sale: 22, color: '#6e2a35', rating: 4.7, reviews: 1872, tag: '단독', sub: '맨투맨' }
  ],
  shoes: [
    { id: 'S01', brand: 'NIKE', name: '에어 포스 1 07 화이트', price: 139000, sale: 0, color: '#f5f5f5', rating: 4.9, reviews: 54012, tag: '무료배송', sub: '스니커즈' },
    { id: 'S02', brand: 'ADIDAS', name: '삼바 OG 블랙 화이트 검', price: 139000, sale: 10, color: '#222222', rating: 4.9, reviews: 21840, tag: '인기', sub: '스니커즈' },
    { id: 'S03', brand: 'NEW BALANCE', name: '530 화이트 실버 네이비', price: 119000, sale: 15, color: '#c9ccd3', rating: 4.8, reviews: 18322, tag: '무료배송', sub: '러닝' },
    { id: 'S04', brand: 'DR.MARTENS', name: '1461 3홀 스무스 블랙', price: 219000, sale: 20, color: '#141414', rating: 4.8, reviews: 6720, tag: '', sub: '로퍼/구두' },
    { id: 'S05', brand: 'CONVERSE', name: '척 70 하이 파치먼트', price: 99000, sale: 25, color: '#ede3cf', rating: 4.7, reviews: 12001, tag: '세일', sub: '스니커즈' },
    { id: 'S06', brand: 'ASICS', name: '젤-카야노 14 크림 블랙', price: 189000, sale: 0, color: '#e2dccd', rating: 4.9, reviews: 4410, tag: '신상', sub: '러닝' },
    { id: 'S07', brand: 'CROCS', name: '클래식 클로그 본', price: 59900, sale: 30, color: '#d9c7a3', rating: 4.6, reviews: 9830, tag: '', sub: '샌들/슬리퍼' },
    { id: 'S08', brand: 'VANS', name: '올드스쿨 블랙 화이트', price: 75000, sale: 12, color: '#2a2a2a', rating: 4.8, reviews: 26540, tag: '무료배송', sub: '스니커즈' },
    { id: 'S09', brand: 'SALOMON', name: 'XT-6 블랙 팬텀', price: 249000, sale: 0, color: '#3a3d40', rating: 4.8, reviews: 2210, tag: '', sub: '러닝' },
    { id: 'S10', brand: 'BIRKENSTOCK', name: '보스턴 스웨이드 토프', price: 199000, sale: 10, color: '#8c7a66', rating: 4.9, reviews: 7710, tag: '인기', sub: '샌들/슬리퍼' }
  ],
  pants: [
    { id: 'P01', brand: 'LEVIS', name: '501 오리지널 핏 진 미디엄 인디고', price: 119000, sale: 30, color: '#4a6a96', rating: 4.8, reviews: 14220, tag: '무료배송', sub: '데님' },
    { id: 'P02', brand: 'DIAMOND LAYLA', name: '와이드 데님 팬츠 라이트 블루', price: 69000, sale: 20, color: '#9fb8d6', rating: 4.7, reviews: 6650, tag: '단독', sub: '데님' },
    { id: 'P03', brand: 'STANDARD', name: '세미 와이드 슬랙스 블랙', price: 39900, sale: 25, color: '#1d1d1d', rating: 4.9, reviews: 41003, tag: '무료배송', sub: '슬랙스' },
    { id: 'P04', brand: 'DICKIES', name: '874 오리지널 워크 팬츠 카키', price: 69000, sale: 10, color: '#a79a74', rating: 4.8, reviews: 9811, tag: '', sub: '면바지' },
    { id: 'P05', brand: 'NIKE', name: '클럽 플리스 조거 팬츠 그레이', price: 75000, sale: 15, color: '#a5a5a5', rating: 4.8, reviews: 12054, tag: '인기', sub: '트레이닝' },
    { id: 'P06', brand: 'PARTIMENTO', name: '카펜터 와이드 카고 팬츠 차콜', price: 79000, sale: 35, color: '#45464a', rating: 4.6, reviews: 3201, tag: '세일', sub: '카고' },
    { id: 'P07', brand: 'LMC', name: '나일론 파라슈트 팬츠 올리브', price: 89000, sale: 0, color: '#5d6343', rating: 4.7, reviews: 1220, tag: '신상', sub: '카고' },
    { id: 'P08', brand: 'COVERNAT', name: '코튼 치노 팬츠 베이지', price: 65000, sale: 20, color: '#d6c5a3', rating: 4.8, reviews: 5402, tag: '무료배송', sub: '면바지' },
    { id: 'P09', brand: 'ADIDAS', name: '파이어버드 트랙 팬츠 블랙', price: 89000, sale: 10, color: '#202020', rating: 4.9, reviews: 8833, tag: '', sub: '트레이닝' },
    { id: 'P10', brand: 'OUTFIT BASIC', name: '크롭 스트레이트 데님 블랙', price: 49900, sale: 30, color: '#2c2f36', rating: 4.8, reviews: 17722, tag: '무료배송', sub: '데님' }
  ]
};

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

function findProduct(id) {
  for (const category in PRODUCTS) {
    const p = PRODUCTS[category].find(item => item.id === id);
    if (p) return { ...p, category };
  }
  return null;
}

function salePrice(p) {
  return Math.round((p.price * (100 - p.sale)) / 100 / 100) * 100;
}

function won(n) {
  return n.toLocaleString('ko-KR') + '원';
}
