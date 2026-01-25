const { chromium } = require('playwright');

/**
 * PinDirect 크롤러
 * @param {string[]} countries - 크롤링할 국가 목록 (예: ['일본', '베트남', '필리핀'])
 * @returns {Promise<Array>} 크롤링된 상품 데이터 배열
 */
async function crawl(countries) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const allProducts = [];

  try {
    console.log('🌐 PinDirect (핀다이렉트) 크롤링 시작...');

    for (const country of countries) {
      console.log(`\n  📍 ${country} 수집 중...`);

      try {
        // 페이지 접속
        await page.goto('https://www.pindirectshop.com/roaming/pindirect', {
          waitUntil: 'networkidle',
          timeout: 60000
        });

        await page.waitForTimeout(5000);

        // 스크롤해서 콘텐츠 로딩
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(2000);

        // 국가 DIV 찾기 및 클릭
        const countryDivs = await page.locator(`div:has-text("${country}")`).all();
        let clicked = false;

        for (const div of countryDivs) {
          const text = await div.textContent();
          if (text && text.trim() === country) {
            await div.click();
            clicked = true;
            await page.waitForTimeout(3000);
            break;
          }
        }

        if (!clicked) {
          console.log(`    ⚠️ ${country} DIV를 찾지 못함`);
          continue;
        }

        // 상품 버튼 찾기
        const productButtons = await page.locator('button[class*="css-"]').all();

        for (const btn of productButtons) {
          try {
            const text = await btn.textContent();
            if (text && text.includes('원')) {
              const priceMatch = text.match(/[\d,]+원/);
              const price = priceMatch ? priceMatch[0] : '';

              let dataAmount = '';
              const patterns = [/완전무제한/, /일\s*\d+[GM]B/, /\d+[GM]B/];
              for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                  dataAmount = match[0];
                  break;
                }
              }

              if (price) {
                allProducts.push({
                  country,
                  network_type: '로밍',
                  product_name: `${country} 로밍`,
                  data_amount: dataAmount,
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

    console.log(`\n  ✅ PinDirect 총 ${allProducts.length}개 상품 수집 완료`);

  } finally {
    await browser.close();
  }

  return allProducts;
}

module.exports = { crawl, name: 'PinDirect (핀다이렉트)' };
