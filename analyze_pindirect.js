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

    // 페이지 새로 접속
    console.log(`  페이지 접속 중...`);
    await page.goto('https://www.pindirectshop.com/roaming/pindirect', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // JavaScript 렌더링 대기
    await page.waitForTimeout(5000);

    // 스크롤해서 콘텐츠 로딩
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2000);

    try {
      // 국가 DIV 찾기
      const countryDivs = await page.locator(`div:has-text("${country}")`).all();
      console.log(`  발견된 DIV: ${countryDivs.length}개`);

      let clicked = false;
      for (const div of countryDivs) {
        try {
          const text = await div.textContent();
          // "일본"만 포함하는 짧은 텍스트 찾기
          if (text && text.trim() === country) {
            console.log(`  "${country}" DIV 클릭 중...`);
            await div.click();
            clicked = true;
            await page.waitForTimeout(3000);
            break;
          }
        } catch (e) {}
      }

      if (!clicked) {
        console.log(`  ❌ ${country} DIV를 찾지 못함`);
        continue;
      }

      // 상품 버튼 찾기
      console.log(`\n  ${country} 상품 수집:`);

      const productButtons = await page.locator('button[class*="css-"]').all();
      console.log(`  발견된 버튼: ${productButtons.length}개`);

      for (let i = 0; i < productButtons.length; i++) {
        try {
          const text = await productButtons[i].textContent();

          if (text && text.includes('원')) {
            const className = await productButtons[i].getAttribute('class');

            // 가격 추출
            const priceMatch = text.match(/[\d,]+원/);
            const price = priceMatch ? priceMatch[0] : '';

            // 데이터량 추출
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
              console.log(`    - 데이터: ${dataAmount || 'N/A'}, 가격: ${price}`);

              allProducts.push({
                country: country,
                network_type: '로밍',
                product_name: `${country} 로밍`,
                data_amount: dataAmount,
                price: price,
                crawled_at: new Date().toISOString()
              });
            }
          }
        } catch (e) {}
      }

      console.log(`  ✅ ${country} 상품 ${allProducts.filter(p => p.country === country).length}개 수집 완료`);

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
      console.log(`  - ${p.data_amount}: ${p.price}`);
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

    fs.writeFileSync('pindirect_products.csv', '\uFEFF' + csvContent, 'utf8');
    console.log(`✅ pindirect_products.csv에 ${allProducts.length}개 저장 완료!`);
  }

  console.log('\n⏸️  10초 동안 대기합니다...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('\n✅ 분석 완료!');
})();
