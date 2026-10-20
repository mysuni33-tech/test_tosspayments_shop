# OUTFIT - 토스페이먼츠 연동 쇼핑몰 데모

HTML, CSS, JavaScript로 만든 의류 쇼핑몰에 토스페이먼츠 결제위젯(v2)과 Supabase(DB, 회원)를 연동한 예제입니다.

## 페이지

| 파일 | 설명 |
| --- | --- |
| `index.html` / `shoes.html` / `pants.html` | 상의 / 신발 / 바지 상품 (품절 표시, 찜, 리뷰) |
| `checkout.html` | 주문서 (배송지) + 토스페이먼츠 결제위젯 |
| `success.html` | 결제 승인 및 완료 |
| `fail.html` | 결제 실패 (실패 사유를 주문에 기록) |
| `login.html` | 로그인 / 회원가입 |
| `mypage.html` | 주문 내역 · 찜 목록 · 내 정보 |
| `admin.html` | 관리자: 주문 관리 · 상품 관리 |

## 실행

Node.js만 있으면 되고, 따로 설치할 패키지는 없습니다.

1. `.env.example`을 복사해 `.env`로 저장하고 `SUPABASE_SECRET_KEY`에 Supabase 시크릿 키(`sb_secret_...`)를 넣습니다.
2. 서버를 실행합니다.

```bash
node server.js
```

브라우저에서 http://localhost:8080 을 열어 주세요. HTML 파일을 직접 열면 결제위젯과 결제 승인이 동작하지 않습니다.

## 결제 흐름

1. 주문서에서 `POST /api/orders` 호출 → 서버가 DB의 가격과 재고로 결제 금액을 계산하고 주문을 저장합니다. (결제 대기)
2. 결제위젯 `requestPayment()` → 토스페이먼츠 결제창에서 인증합니다.
3. `success.html`에서 `POST /api/confirm` 호출 → 서버가 금액을 검증하고 재고를 차감한 뒤 결제 승인 API를 호출합니다. (결제 완료)
4. 취소하면 서버가 토스에 결제 취소를 요청하고 재고를 되돌립니다.

## 키 설정

- 토스페이먼츠: 기본값은 문서에 공개된 **테스트 키**라서 실제로 결제되지 않습니다. 클라이언트 키는 `js/checkout.js`, 시크릿 키는 `.env`의 `TOSS_SECRET_KEY`.
- Supabase: 공개 키는 `js/db.js`, 시크릿 키는 `.env`의 `SUPABASE_SECRET_KEY` (브라우저 코드와 Git에 올리지 마세요).
