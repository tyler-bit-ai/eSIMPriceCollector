const { chromium } = require('playwright');

// 페이지 끝까지 스크롤
async function scrollToBottom(page) {
  let previousHeight = 0;
  let stableCount = 0;
  const maxStable = 3;

  while (stableCount < maxStable) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    if (currentHeight === previousHeight) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    previousHeight = currentHeight;
  }
}

// 상품 정보 추출
async function extractProductInfo(page, country, networkType) {
  const products = [];

  try {
    const optionBoxes = await page.locator('.option-box').all();

    for (const box of optionBoxes) {
      try {
        let dataAmount = '';
        let price = '';

        // 데이터량 추출
        const dataElement = await box.locator('.option-value').first();
        if (await dataElement.count() > 0) {
          dataAmount = (await dataElement.textContent()).trim();
        }

        // 가격 추출
        const priceElement = await box.locator('.price').first();
        if (await priceElement.count() > 0) {
          price = (await priceElement.textContent()).trim();
        }

        // 데이터량이 비어있으면 전체 텍스트에서 추출
        if (!dataAmount) {
          const fullText = await box.textContent();
          const patterns = [/완전\s*무제한/, /매일\s*\d+[GM]B\s*이후\s*저속\s*무제한/, /\d+[GM]B/, /무제한/];
          for (const pattern of patterns) {
            const match = fullText.match(pattern);
            if (match) {
              dataAmount = match[0];
              break;
            }
          }
        }

        // 가격이 비어있으면 전체 텍스트에서 추출
        if (!price) {
          const fullText = await box.textContent();
          const priceMatch = fullText.match(/[\d,]+원/);
          if (priceMatch) price = priceMatch[0];
        }

        if (dataAmount || price) {
          products.push({
            country,
            network_type: networkType,
            product_name: `${country} ${networkType}`,
            data_amount: dataAmount,
            price,
            crawled_at: new Date().toISOString()
          });
        }
      } catch (e) {}
    }
  } catch (e) {}

  return products;
}

/**
 * USIMSA 크롤러
 * @param {string[]} countries - 크롤링할 국가 목록 (예: ['일본', '베트남', '필리핀'])
 * @returns {Promise<Array>} 크롤링된 상품 데이터 배열
 */
async function crawl(countries) {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const allProducts = [];

  try {
    console.log('🌐 USIMSA (유심사) 크롤링 시작...');
    await page.goto('https://www.usimsa.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    for (const country of countries) {
      console.log(`\n  📍 ${country} 수집 중...`);

      try {
        // 국가 선택
        const countryItems = await page.locator('.product-flag-item').all();
        let countryFound = false;
        for (const item of countryItems) {
          const text = await item.textContent();
          if (text.includes(country)) {
            await item.click();
            countryFound = true;
            break;
          }
        }

        if (!countryFound) {
          console.log(`    ⚠️ ${country}를 찾지 못함`);
          continue;
        }

        await page.waitForTimeout(3000);
        await scrollToBottom(page);

        // 로밍망 상품 수집
        const roamingProducts = await extractProductInfo(page, country, '로밍망');
        allProducts.push(...roamingProducts);

        // 로컬망 탭 클릭
        try {
          const localTab = await page.locator('[role="tab"]:has-text("로컬망")').first();
          if (await localTab.count() > 0) {
            await localTab.click();
            await page.waitForTimeout(2000);
            await scrollToBottom(page);
            const localProducts = await extractProductInfo(page, country, '로컬망');
            allProducts.push(...localProducts);
          }
        } catch (e) {}

        console.log(`    ✅ ${country}: ${roamingProducts.length}개 (로밍망) + ${(allProducts.filter(p => p.country === country && p.network_type === '로컬망').length)}개 (로컬망)`);

        // 홈으로 돌아가기
        await page.goto('https://www.usimsa.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log(`    ❌ ${country} 수집 실패: ${e.message}`);
      }
    }

    console.log(`\n  ✅ USIMSA 총 ${allProducts.length}개 상품 수집 완료`);

  } finally {
    await browser.close();
  }

  return allProducts;
}

module.exports = { crawl, name: 'USIMSA (유심사)' };
