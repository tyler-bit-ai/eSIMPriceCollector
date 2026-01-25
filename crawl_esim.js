const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// CSV 파일 생성 헬퍼 함수
function saveToCSV(data, filename) {
  if (data.length === 0) {
    console.log(`⚠️ 저장할 데이터가 없습니다.`);
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header] || '';
      // 쉼표가 있으면 따옴표로 감싸기
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  fs.writeFileSync(filename, '\uFEFF' + csvContent, 'utf8'); // UTF-8 BOM 추가 (엑셀 호환)
  console.log(`✅ ${filename}에 ${data.length}개 저장 완료!`);
}

// 페이지 끝까지 스크롤
async function scrollToBottom(page) {
  console.log('📜 페이지 스크롤 중...');
  let previousHeight = 0;
  let stableCount = 0;
  const maxStable = 3; // 높이가 변하지 않은 횟수

  while (stableCount < maxStable) {
    // 현재 페이지 높이 계산
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    // 페이지 끝까지 스크롤
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // 새 콘텐츠 로딩 대기
    await page.waitForTimeout(1500);

    // 높이가 변했는지 확인
    if (currentHeight === previousHeight) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    previousHeight = currentHeight;
  }
  console.log('✅ 스크롤 완료');
}

// 상품 정보 추출
async function extractProductInfo(page, country, networkType) {
  const products = [];

  try {
    // 상품 옵션 박스 찾기
    const optionBoxes = await page.locator('.option-box').all();
    console.log(`   발견된 상품 옵션: ${optionBoxes.length}개`);

    for (let i = 0; i < optionBoxes.length; i++) {
      try {
        const box = optionBoxes[i];

        // 데이터량 추출
        let dataAmount = '';
        try {
          const dataElement = await box.locator('.option-value').first();
          if (await dataElement.count() > 0) {
            dataAmount = (await dataElement.textContent()).trim();
          }
        } catch (e) {}

        // 가격 추출
        let price = '';
        try {
          const priceElement = await box.locator('.price').first();
          if (await priceElement.count() > 0) {
            price = (await priceElement.textContent()).trim();
          }
        } catch (e) {}

        // 데이터량이 비어있으면 전체 텍스트에서 추출 시도
        if (!dataAmount) {
          const fullText = await box.textContent();
          // "무제한", "GB", "MB" 등의 패턴 찾기
          const patterns = [
            /완전\s*무제한/,
            /매일\s*\d+[GM]B\s*이후\s*저속\s*무제한/,
            /\d+[GM]B/,
            /\d+[GM]B\s*이후\s*저속\s*무제한/,
            /무제한/
          ];
          for (const pattern of patterns) {
            const match = fullText.match(pattern);
            if (match) {
              dataAmount = match[0];
              break;
            }
          }
        }

        // 가격이 비어있으면 전체 텍스트에서 추출 시도
        if (!price) {
          const fullText = await box.textContent();
          const priceMatch = fullText.match(/[\d,]+원/);
          if (priceMatch) {
            price = priceMatch[0];
          }
        }

        if (dataAmount || price) {
          products.push({
            country: country,
            network_type: networkType,
            product_name: `${country} ${networkType}`,
            data_amount: dataAmount,
            price: price,
            crawled_at: new Date().toISOString()
          });
          console.log(`      [${i + 1}] 데이터: ${dataAmount}, 가격: ${price}`);
        }
      } catch (e) {
        console.log(`      [${i + 1}] 추출 실패: ${e.message}`);
      }
    }

    // option-box가 없는 경우 대체 방법: 모든 옵션 관련 요소에서 추출
    if (products.length === 0) {
      console.log('   ⚠️ .option-box를 찾지 못함. 대체 방법 시도...');

      const allOptions = await page.locator('[class*="option"]').all();
      console.log(`   발견된 option 요소: ${allOptions.length}개`);

      for (const option of allOptions) {
        try {
          const text = await option.textContent();

          // 가격 패턴
          const priceMatch = text.match(/[\d,]+원/);
          // 데이터 패턴
          const dataPatterns = [
            /완전\s*무제한/,
            /매일\s*\d+[GM]B\s*이후\s*저속\s*무제한/,
            /\d+[GM]B/
          ];

          let dataAmount = '';
          for (const pattern of dataPatterns) {
            const match = text.match(pattern);
            if (match) {
              dataAmount = match[0];
              break;
            }
          }

          if (priceMatch && dataAmount) {
            products.push({
              country: country,
              network_type: networkType,
              product_name: `${country} ${networkType}`,
              data_amount: dataAmount,
              price: priceMatch[0],
              crawled_at: new Date().toISOString()
            });
          }
        } catch (e) {}
      }
    }

  } catch (e) {
    console.log(`   ❌ 상품 추출 오류: ${e.message}`);
  }

  return products;
}

// 메인 크롤링 함수
async function crawlUsimsa() {
  const browser = await chromium.launch({
    headless: false,  // 헤드풀 모드 (브라우저 보임)
    slowMo: 500,      // 동작을 천천히해서 사람 같게 만듦
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // 크롤링할 국가 목록
  const countries = ['일본', '베트남', '필리핀'];
  const allProducts = [];

  try {
    console.log('🌐 usimsa.com 접속 중...');
    await page.goto('https://www.usimsa.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    for (const country of countries) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📍 ${country} 상품 수집 시작`);
      console.log('='.repeat(50));

      // 국가 선택
      console.log(`\n1️⃣ ${country} 페이지로 이동 중...`);
      const countryItems = await page.locator('.product-flag-item').all();

      let countryFound = false;
      for (const item of countryItems) {
        const text = await item.textContent();
        if (text.includes(country)) {
          await item.click();
          countryFound = true;
          console.log(`   ✅ ${country} 클릭 완료`);
          break;
        }
      }

      if (!countryFound) {
        console.log(`   ❌ ${country}를 찾지 못함`);
        continue;
      }

      await page.waitForTimeout(3000);

      // 페이지 스크롤 (모든 콘텐츠 로딩)
      await scrollToBottom(page);

      // 로밍망 상품 수집
      console.log(`\n2️⃣ 로밍망 상품 수집 중...`);
      const roamingProducts = await extractProductInfo(page, country, '로밍망');
      allProducts.push(...roamingProducts);

      // 로컬망 탭 클릭
      console.log(`\n3️⃣ 로컬망 탭으로 전환...`);
      try {
        const localTab = await page.locator('[role="tab"]:has-text("로컬망")').first();
        if (await localTab.count() > 0) {
          await localTab.click();
          await page.waitForTimeout(2000);

          // 스크롤 후 로컬망 상품 수집
          await scrollToBottom(page);
          const localProducts = await extractProductInfo(page, country, '로컬망');
          allProducts.push(...localProducts);
        } else {
          console.log('   ⚠️ 로컬망 탭을 찾지 못함');
        }
      } catch (e) {
        console.log(`   ❌ 로컬망 탭 전환 실패: ${e.message}`);
      }

      console.log(`\n✅ ${country} 수집 완료! (현재까지 총 ${allProducts.length}개)`);

      // 홈으로 돌아가기 (다음 국가를 위해)
      await page.goto('https://www.usimsa.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
    }

    // CSV 저장
    console.log(`\n${'='.repeat(50)}`);
    console.log('💾 CSV 파일 저장 중...');
    console.log('='.repeat(50));

    const csvPath = path.join(__dirname, 'esim_list.csv');
    saveToCSV(allProducts, csvPath);

    // 결과 출력
    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 수집 결과 요약');
    console.log('='.repeat(50));
    console.log(`총 상품 수: ${allProducts.length}개`);

    const byCountry = {};
    for (const p of allProducts) {
      if (!byCountry[p.country]) {
        byCountry[p.country] = { 로밍망: 0, 로컬망: 0 };
      }
      byCountry[p.country][p.network_type]++;
    }

    for (const [country, types] of Object.entries(byCountry)) {
      console.log(`  ${country}: 로밍망 ${types.로밍망}개, 로컬망 ${types.로컬망}개`);
    }

    console.log(`\n✅ 크롤링 완료!`);

  } catch (error) {
    console.error('❌ 크롤링 중 오류 발생:', error);
  } finally {
    await browser.close();
  }
}

// 실행
crawlUsimsa().catch(console.error);
