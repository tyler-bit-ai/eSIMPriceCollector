const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const countries = ['일본', '베트남', '필리핀'];
  const allProducts = [];

  for (const country of countries) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📍 ${country} 상품 분석`);
    console.log('='.repeat(50));

    // 페이지 접속
    console.log(`  페이지 접속 중...`);
    await page.goto('https://dosirakesim.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // JavaScript 렌더링 대기
    await page.waitForTimeout(5000);

    // 팝업 닫기
    console.log(`  팝업 닫는 중...`);
    try {
      await page.evaluate(() => {
        const overlay = document.getElementById('eSIM_popup_overlay');
        if (overlay) overlay.remove();
      });
      await page.waitForTimeout(1000);
    } catch (e) {}

    try {
      // 국가 버튼 클릭
      console.log(`  ${country} 버튼 클릭 중...`);
      const countryButton = await page.locator(`button.item:has-text("${country}")`).first();
      await countryButton.evaluate(el => el.click());
      await page.waitForTimeout(5000);

      console.log(`  URL: ${page.url()}`);

      // .card 요소 분석
      console.log(`\n  ${country} 상품 카드 추출:`);
      const cards = await page.locator('.card').all();
      console.log(`  발견된 카드: ${cards.length}개`);

      for (let i = 0; i < cards.length; i++) {
        try {
          const card = cards[i];
          const text = await card.textContent();

          // .product-info 요소에서 정보 추출
          const productInfo = await card.locator('.product-info').first();
          if (await productInfo.count() > 0) {
            const infoText = await productInfo.textContent();
            console.log(`    [${i + 1}] ${infoText?.trim()}`);

            // 가격 추출
            const priceMatch = infoText.match(/[\d,]+\s*원/);
            const price = priceMatch ? priceMatch[0].replace(/\s+/g, '') : '';

            // 데이터량 추출
            let dataAmount = '';
            const dataMatch = infoText.match(/\d+[GM]B|무제한/);
            if (dataMatch) {
              dataAmount = dataMatch[0];
            }

            // 기간 추출
            const dayMatch = infoText.match(/\d+\s*일/);
            const days = dayMatch ? dayMatch[0] : '';

            // 망 타입 (로컬/로밍)
            const isLocal = infoText.includes('로컬');
            const networkType = isLocal ? '로컬망' : '로밍망';

            if (price && dataAmount) {
              allProducts.push({
                country: country,
                network_type: networkType,
                product_name: `${country} 도시락eSIM`,
                data_amount: `${dataAmount}/${days}`,
                price: price,
                crawled_at: new Date().toISOString()
              });
            }
          }
        } catch (e) {
          console.log(`    [${i + 1}] 추출 실패: ${e.message}`);
        }
      }

    } catch (e) {
      console.log(`  ❌ ${country} 분석 실패: ${e.message}`);
    }
  }

  // 결과 저장
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 수집 결과 요약');
  console.log('='.repeat(50));
  console.log(`총 상품: ${allProducts.length}개\n`);

  for (const country of countries) {
    const countryProducts = allProducts.filter(p => p.country === country);
    console.log(`${country}: ${countryProducts.length}개`);
    for (const p of countryProducts) {
      console.log(`  - ${p.data_amount} (${p.network_type}): ${p.price}`);
    }
    console.log('');
  }

  // CSV 저장
  if (allProducts.length > 0) {
    const fs = require('fs');
    const headers = Object.keys(allProducts[0]);
    const csvContent = [
      headers.join(','),
      ...allProducts.map(row => headers.map(header => {
        const value = row[header] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    fs.writeFileSync('dosirak_products.csv', '\uFEFF' + csvContent, 'utf8');
    console.log(`✅ dosirak_products.csv에 ${allProducts.length}개 저장 완료!`);
  }

  console.log('\n⏸️  10초 동안 대기합니다...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('\n✅ 분석 완료!');
})();
