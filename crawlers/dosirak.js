const { chromium } = require('playwright');

/**
 * Dosirak 크롤러
 * @param {string[]} countries - 크롤링할 국가 목록 (예: ['일본', '베트남', '필리핀'])
 * @returns {Promise<Array>} 크롤링된 상품 데이터 배열
 */
async function crawl(countries) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const allProducts = [];

  try {
    console.log('🌐 Dosirak (도시락eSIM) 크롤링 시작...');

    for (const country of countries) {
      console.log(`\n  📍 ${country} 수집 중...`);

      try {
        // 페이지 접속
        await page.goto('https://dosirakesim.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 90000
        });

        await page.waitForTimeout(5000);

        // 팝업 닫기
        try {
          await page.evaluate(() => {
            const overlay = document.getElementById('eSIM_popup_overlay');
            if (overlay) overlay.remove();
          });
          await page.waitForTimeout(1000);
        } catch (e) {}

        // 국가 버튼 클릭
        const countryButton = await page.locator(`button.item:has-text("${country}")`).first();
        await countryButton.evaluate(el => el.click());
        await page.waitForTimeout(5000);

        // .card 요소 분석
        const cards = await page.locator('.card').all();

        for (const card of cards) {
          try {
            const productInfo = await card.locator('.product-info').first();
            if (await productInfo.count() > 0) {
              const infoText = await productInfo.textContent();

              const priceMatch = infoText.match(/[\d,]+\s*원/);
              const price = priceMatch ? priceMatch[0].replace(/\s+/g, '') : '';

              let dataAmount = '';
              const dataMatch = infoText.match(/\d+[GM]B|무제한/);
              if (dataMatch) dataAmount = dataMatch[0];

              const dayMatch = infoText.match(/\d+\s*일/);
              const days = dayMatch ? dayMatch[0] : '';

              const isLocal = infoText.includes('로컬');
              const networkType = isLocal ? '로컬망' : '로밍망';

              if (price && dataAmount) {
                allProducts.push({
                  country,
                  network_type: networkType,
                  product_name: `${country} 도시락eSIM`,
                  data_amount: `${dataAmount}/${days}`,
                  price,
                  crawled_at: new Date().toISOString()
                });
              }
            }
          } catch (e) {}
        }

        const count = allProducts.filter(p => p.country === country).length;
        console.log(`    ✅ ${country}: ${count}개 상품 수집 완료`);

      } catch (e) {
        console.log(`    ❌ ${country} 수집 실패: ${e.message}`);
      }
    }

    console.log(`\n  ✅ Dosirak 총 ${allProducts.length}개 상품 수집 완료`);

  } finally {
    await browser.close();
  }

  return allProducts;
}

module.exports = { crawl, name: 'Dosirak (도시락eSIM)' };
