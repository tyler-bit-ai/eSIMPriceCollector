const { chromium } = require('playwright');

/**
 * 로밍도깨비(Rokebi) 크롤러
 * @param {string[]} countries - 크롤링할 국가 목록 (예: ['일본', '베트남', '필리핀'])
 * @returns {Promise<Array>} 크롤링된 상품 데이터 배열
 */
async function crawl(countries) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const allProducts = [];

  // 국가별 URL 매핑
  const categoryMap = {
    '일본': { roaming: '463', local: '511' },
    '베트남': { roaming: '462', local: '516' },
    '필리핀': { roaming: '497', local: null }
  };

  try {
    console.log('🌐 로밍도깨비(Rokebi) 크롤링 시작...');

    for (const country of countries) {
      console.log(`\n  📍 ${country} 수집 중...`);

      const categories = categoryMap[country];
      if (!categories) {
        console.log(`    ⚠️ ${country} 카테고리 정보 없음`);
        continue;
      }

      // 로밍망
      if (categories.roaming) {
        try {
          const url = `https://www.rokebi.com/store?tab=best&categoryItem=${categories.roaming}`;
          console.log(`    로밍망 URL: ${url}`);

          // domcontentloaded로 더 빠르게 로드
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
          await page.waitForTimeout(8000); // 충분한 대기 시간

          // 스크롤
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(3000);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(3000);

          // 다양한 선택자 시도
          const selectors = [
            '.ant-card',
            '.product-card',
            '[class*="ProductCard"]',
            '[class*="product"]',
            '.ant-col'
          ];

          let products = [];
          for (const selector of selectors) {
            try {
              const found = await page.locator(selector).all();
              if (found.length > 0) {
                console.log(`    찾은 요소 (${selector}): ${found.length}개`);
                products = found;
                break;
              }
            } catch (e) {}
          }

          for (const product of products) {
            try {
              const text = await product.textContent();
              if (!text || text.length < 10) continue;

              // 가격 추출 (4일 기준)
              const priceMatch = text.match(/(\d{1,2},?\d{3})원/);
              if (!priceMatch) continue;

              const price = priceMatch[1] + '원';

              // 데이터량 추출
              let dataAmount = '';
              if (text.includes('무제한')) {
                dataAmount = '무제한';
              } else {
                const dataMatch = text.match(/(\d+[GM]B)/);
                if (dataMatch) {
                  dataAmount = dataMatch[1];
                }
              }

              // 4일 기준 확인
              const dayMatch = text.match(/(\d+)일/);
              if (dayMatch && dayMatch[1] !== '4') {
                continue; // 4일이 아니면 스킵
              }

              allProducts.push({
                country,
                network_type: '로밍망',
                product_name: `로밍도깨비 ${country} 4일`,
                data_amount: dataAmount,
                price,
                crawled_at: new Date().toISOString()
              });
            } catch (e) {
              // 무시
            }
          }

          const roamingCount = allProducts.filter(p => p.country === country && p.network_type === '로밍망').length;
          console.log(`    ✅ ${country} 로밍망: ${roamingCount}개`);

        } catch (e) {
          console.log(`    ❌ ${country} 로밍망 수집 실패: ${e.message}`);
        }
      }

      // 로컬망
      if (categories.local) {
        try {
          const url = `https://www.rokebi.com/store?tab=best&categoryItem=${categories.local}`;
          console.log(`    로컬망 URL: ${url}`);

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
          await page.waitForTimeout(8000);

          // 스크롤
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(3000);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(3000);

          // 다양한 선택자 시도
          const selectors = [
            '.ant-card',
            '.product-card',
            '[class*="ProductCard"]',
            '[class*="product"]',
            '.ant-col'
          ];

          let products = [];
          for (const selector of selectors) {
            try {
              const found = await page.locator(selector).all();
              if (found.length > 0) {
                products = found;
                break;
              }
            } catch (e) {}
          }

          for (const product of products) {
            try {
              const text = await product.textContent();
              if (!text || text.length < 10) continue;

              // 가격 추출 (4일 기준)
              const priceMatch = text.match(/(\d{1,2},?\d{3})원/);
              if (!priceMatch) continue;

              const price = priceMatch[1] + '원';

              // 데이터량 추출
              let dataAmount = '';
              if (text.includes('무제한')) {
                dataAmount = '무제한';
              } else {
                const dataMatch = text.match(/(\d+[GM]B)/);
                if (dataMatch) {
                  dataAmount = dataMatch[1];
                }
              }

              // 4일 기준 확인
              const dayMatch = text.match(/(\d+)일/);
              if (dayMatch && dayMatch[1] !== '4') {
                continue; // 4일이 아니면 스킵
              }

              allProducts.push({
                country,
                network_type: '로컬망',
                product_name: `로밍도깨비 ${country} 4일`,
                data_amount: dataAmount,
                price,
                crawled_at: new Date().toISOString()
              });
            } catch (e) {
              // 무시
            }
          }

          const localCount = allProducts.filter(p => p.country === country && p.network_type === '로컬망').length;
          console.log(`    ✅ ${country} 로컬망: ${localCount}개`);

        } catch (e) {
          console.log(`    ❌ ${country} 로컬망 수집 실패: ${e.message}`);
        }
      }

      const totalCount = allProducts.filter(p => p.country === country).length;
      console.log(`    ✅ ${country}: 총 ${totalCount}개 상품 수집 완료`);
    }

    console.log(`\n  ✅ 로밍도깨비 총 ${allProducts.length}개 상품 수집 완료`);

  } finally {
    await browser.close();
  }

  return allProducts;
}

module.exports = { crawl, name: 'Rokebi (로밍도깨비)' };
