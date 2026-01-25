# eSIM 가격 비교 크롤러

일본, 베트남, 필리핀 eSIM 상품 가격을 수집하여 비교하는 크롤러입니다.

## 지원 사이트

- **USIMSA (유심사)**: https://www.usimsa.com/
- **PinDirect (핀다이렉트)**: https://www.pindirectshop.com/roaming/pindirect
- **Dosirak (도시락eSIM)**: https://dosirakesim.com/
- **Maaltalk (말톡)**: https://store.maaltalk.com/

## 요구사항

- Node.js 18+
- npm

## 설치

```bash
npm install
```

## 사용법

### 모든 사이트 크롤링

```bash
npm start
```

또는

```bash
node index.js
```

### 개별 크롤러 실행

```bash
# USIMSA만 크롤링
node -e "const {crawl} = require('./crawlers/usimsa'); crawl(['일본', '베트남', '필리핀']).then(console.log).catch(console.error)"

# PinDirect만 크롤링
node -e "const {crawl} = require('./crawlers/pindirect'); crawl(['일본', '베트남', '필리핀']).then(console.log).catch(console.error)"

# Dosirak만 크롤링
node -e "const {crawl} = require('./crawlers/dosirak'); crawl(['일본', '베트남', '필리핀']).then(console.log).catch(console.error)"

# Maaltalk만 크롤링
node -e "const {crawl} = require('./crawlers/maaltalk'); crawl(['일본', '베트남', '필리핀']).then(console.log).catch(console.error)"
```

## 출력 파일

크롤링 완료 후 다음 파일들이 생성됩니다:

- `esim_prices_[타임스탬프].csv` - CSV 형식 결과
- `esim_prices_[타임스탬프].xlsx` - 엑셀 형식 결과 (여러 시트 포함)

### 엑셀 파일 구조

1. **전체** 시트: 모든 수집 데이터
2. **사이트별** 시트: USIMSA, PinDirect, Dosirak, Maaltalk
3. **국가별** 시트: 일본, 베트남, 필리핀
4. **요약** 시트: 사이트/국가별 상품 수, 최저가, 최고가

## 데이터 필드

- `country`: 국가 (일본, 베트남, 필리핀)
- `network_type`: 망 타입 (로밍망, 로컬망)
- `product_name`: 상품명
- `data_amount`: 데이터 제공량
- `price`: 가격
- `crawled_at`: 수집 일시

## 프로젝트 구조

```
eSIMPriceCollector/
├── index.js           # 메인 실행 파일
├── package.json       # 의존성 및 스크립트
├── crawlers/          # 크롤러 모듈
│   ├── usimsa.js
│   ├── pindirect.js
│   ├── dosirak.js
│   └── maaltalk.js
└── README.md
```

## 주의사항

- 모든 크롤러는 헤드풀 모드로 실행됩니다 (브라우저가 보입니다).
- 크롤링 시간은 사이트별로 다르지만 전체 실행 시 약 5-10분 소요됩니다.
- 일부 사이트는 팝업이나 동적 로딩이 있어 대기 시간이 필요합니다.

## 라이선스

ISC
