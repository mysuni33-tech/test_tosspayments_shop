# OUTFIT - 토스페이먼츠 연동 쇼핑몰 데모

HTML, CSS, JavaScript로 만든 의류 쇼핑몰 퍼블리싱 페이지에 토스페이먼츠 결제위젯(v2)을 연동한 예제입니다.

## 페이지

| 파일 | 설명 |
| --- | --- |
| `index.html` | 상의 상품 페이지 |
| `shoes.html` | 신발 상품 페이지 |
| `pants.html` | 바지 상품 페이지 |
| `checkout.html` | 주문서 + 토스페이먼츠 결제위젯 |
| `success.html` | 결제 승인 및 완료 페이지 |
| `fail.html` | 결제 실패 페이지 |

## 실행

Node.js만 있으면 되고, 따로 설치할 패키지는 없습니다.

```bash
node server.js
```

브라우저에서 http://localhost:8080 을 열어 주세요. HTML 파일을 직접 열면 결제위젯과 결제 승인이 동작하지 않습니다.

## 결제 흐름

1. 주문서에서 `POST /api/orders` 호출 → 서버가 상품 데이터로 결제 금액을 계산하고 주문을 만듭니다.
2. 결제위젯 `requestPayment()` → 토스페이먼츠 결제창에서 인증합니다.
3. `success.html`에서 `POST /api/confirm` 호출 → 서버가 금액을 검증하고 시크릿 키로 결제 승인 API를 호출합니다.

## 키 설정

기본값은 토스페이먼츠 문서에 공개된 **테스트 키**라서 실제로 결제되지 않습니다.

- 클라이언트 키: `js/checkout.js`의 `TOSS_CLIENT_KEY`
- 시크릿 키: 환경변수 `TOSS_SECRET_KEY` (브라우저 코드에 넣지 마세요)

```bash
TOSS_SECRET_KEY=test_gsk_... node server.js
```

> 주문 정보를 서버 메모리에 저장하는 데모입니다. 실제 서비스에서는 DB에 저장하세요.
