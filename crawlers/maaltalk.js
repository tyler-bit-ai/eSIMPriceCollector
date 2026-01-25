const { chromium } = require('playwright');

/**
 * Maaltalk 크롤러
 * @param {string[]} countries - 크롤링할 국가 목록 (예: ['일본', '베트남', '필리핀'])
 * @returns {Promise<Array>} 크롤링된 상품 데이터 배열
 */
async function crawl(countries) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const allProducts = [];

  try {
    console.log('🌐 Maaltalk (말톡) 크롤링 시작...');

    const countryUrls = {
      '일본': 'https://store.maaltalk.com/goods/goods_list.php?cateCd=001',
      '베트남': 'https://store.maaltalk.com/goods/goods_list.php?cateCd=002004',
      '필리핀': 'https://store.maaltalk.com/goods/goods_list.php?cateCd=002018'
    };

    for (const country of countries) {
      console.log(`\n  📍 ${country} 수집 중...`);

      try {
        const url = countryUrls[country];
        if (!url) {
          console.log(`    ⚠️ ${country} URL을 찾지 못함`);
          continue;
        }

        // 페이지 접속
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 90000
        });

        await page.waitForTimeout(5000);

        // 스크롤해서 콘텐츠 로딩
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(2000);

        // 모든 LI 요소 찾기 (각 상품 컨테이너)
        const products = await page.evaluate((countryName) => {
          const items = [];
          const listItems = document.querySelectorAll('ul li');

          listItems.forEach(li => {
            try {
              const nameEl = li.querySelector('.item_name');
              if (!nameEl) return;

              const name = nameEl.textContent.trim();

              // 해당 국가 상품만 필터링
              if (!name.includes(countryName)) return;

              // 같은 LI 안에서 가격 찾기
              const priceSpan = li.querySelector('.item_price span');
              const price = priceSpan ? priceSpan.textContent.trim() : '';

              const isEsim = name.toLowerCase().includes('esim') || name.includes('이심') || name.includes('QR코드');
              const productType = isEsim ? 'eSIM' : 'USIM';
              const isLocal = name.includes('로컬망');
              const networkType = isLocal ? '로컬망' : '로밍망';

              if (price && name) {
                items.push({
                  name,
                  price,
                  productType,
                  networkType,
                  dataAmount: '무제한/일'
                });
              }
            } catch (e) {}
          });

          return items;
        }, country);

        // 중복 제거
        const seen = new Set();
        const uniqueProducts = [];
        for (const product of products) {
          const key = `${product.name}-${product.price}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueProducts.push(product);
          }
        }

        // 결과 추가
        for (const p of uniqueProducts) {
          allProducts.push({
            country,
            network_type: p.networkType,
            product_name: `${country} 말톡 ${p.productType}`,
            data_amount: p.dataAmount,
            price: p.price,
            crawled_at: new Date().toISOString()
          });
        }

        console.log(`    ✅ ${country}: ${uniqueProducts.length}개 상품 수집 완료`);

      } catch (e) {
        console.log(`    ❌ ${country} 수집 실패: ${e.message}`);
      }
    }

    console.log(`\n  ✅ Maaltalk 총 ${allProducts.length}개 상품 수집 완료`);

  } finally {
    await browser.close();
  }

  return allProducts;
}

module.exports = { crawl, name: 'Maaltalk (말톡)' };
