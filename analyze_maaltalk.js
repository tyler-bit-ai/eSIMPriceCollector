const { chromium } = require('playwright');

const countries = [
  { name: '일본', url: 'https://store.maaltalk.com/goods/goods_list.php?cateCd=001' },
  { name: '베트남', url: 'https://store.maaltalk.com/goods/goods_list.php?cateCd=002004' },
  { name: '필리핀', url: 'https://store.maaltalk.com/goods/goods_list.php?cateCd=002018' }
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const allProducts = [];

  for (const country of countries) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📍 ${country.name} 상품 분석`);
    console.log('='.repeat(50));

    // 페이지 접속
    console.log(`  페이지 접속 중...`);
    await page.goto(country.url, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
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
      // 디버깅: 요소 개수 확인
      const itemCount = await page.locator('.item_name').count();
      console.log(`  발견된 .item_name: ${itemCount}개`);
      // 모든 상품 추출
      console.log(`\n  ${country.name} 상품 추출:`);

      const products = await page.evaluate((countryName) => {
        const items = [];

        // 모든 LI 요소 찾기 (각 상품 컨테이너)
        const listItems = document.querySelectorAll('ul li');

        listItems.forEach(li => {
          try {
            // 해당 LI 안에서 상품명과 가격 찾기
            const nameEl = li.querySelector('.item_name');
            if (!nameEl) return;

            const name = nameEl.textContent.trim();

            // 해당 국가 상품만 필터링
            if (!name.includes(countryName)) {
              return;
            }

            // 같은 LI 안에서 가격 찾기
            const priceSpan = li.querySelector('.item_price span');
            const price = priceSpan ? priceSpan.textContent.trim() : '';

            // esim 여부
            const isEsim = name.toLowerCase().includes('esim') || name.includes('이심') || name.includes('QR코드');
            const productType = isEsim ? 'eSIM' : 'USIM';

            // 망 타입 (로컬망/로밍망)
            const isLocal = name.includes('로컬망');
            const networkType = isLocal ? '로컬망' : '로밍망';

            // 데이터량
            let dataAmount = '무제한/일';

            if (price && name) {
              items.push({
                name,
                price,
                productType,
                networkType,
                dataAmount
              });
            }
          } catch (e) {
            console.error(e);
          }
        });

        return items;
      }, country.name);

      // 중복 제거 (상품명 + 가격으로)
      const seen = new Set();
      const uniqueProducts = [];

      for (const product of products) {
        const key = `${product.name}-${product.price}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueProducts.push(product);
        }
      }

      console.log(`  발견된 상품: ${products.length}개 (중복 제거 후: ${uniqueProducts.length}개)\n`);

      for (const p of uniqueProducts) {
        console.log(`    - ${p.productType} (${p.networkType}): ${p.price}`);
        console.log(`      상품명: ${p.name.substring(0, 50)}...`);

        allProducts.push({
          country: country.name,
          network_type: p.networkType,
          product_name: `${country.name} 말톡 ${p.productType}`,
          data_amount: p.dataAmount,
          price: p.price,
          crawled_at: new Date().toISOString()
        });
      }

      console.log(`\n  ✅ ${country.name} 상품 ${uniqueProducts.length}개 수집 완료`);

    } catch (e) {
      console.log(`  ❌ ${country.name} 분석 실패: ${e.message}`);
    }
  }

  // 결과 저장
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 수집 결과 요약');
  console.log('='.repeat(50));
  console.log(`총 상품: ${allProducts.length}개\n`);

  for (const country of countries) {
    const countryProducts = allProducts.filter(p => p.country === country.name);

    // eSIM/USIM 그룹화
    const esimProducts = countryProducts.filter(p => p.product_name.includes('eSIM'));
    const usimProducts = countryProducts.filter(p => p.product_name.includes('USIM'));

    console.log(`${country.name}: ${countryProducts.length}개`);
    if (esimProducts.length > 0) {
      console.log(`  eSIM (${esimProducts.length}개):`);
      for (const p of esimProducts) {
        console.log(`    - ${p.data_amount} (${p.network_type}): ${p.price}`);
      }
    }
    if (usimProducts.length > 0) {
      console.log(`  USIM (${usimProducts.length}개):`);
      for (const p of usimProducts) {
        console.log(`    - ${p.data_amount} (${p.network_type}): ${p.price}`);
      }
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

    fs.writeFileSync('maaltalk_products.csv', '\uFEFF' + csvContent, 'utf8');
    console.log(`✅ maaltalk_products.csv에 ${allProducts.length}개 저장 완료!`);
  }

  console.log('\n⏸️  10초 동안 대기합니다...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('\n✅ 분석 완료!');
})();
