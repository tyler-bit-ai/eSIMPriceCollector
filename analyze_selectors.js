const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  console.log('🌐 usimsa.com 접속 중...');
  await page.goto('https://www.usimsa.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  // 일본 요소를 찾아서 클릭
  const items = await page.locator('.product-flag-item').all();
  for (let i = 0; i < items.length; i++) {
    const text = await items[i].textContent();
    if (text.includes('일본')) {
      console.log(`🇯🇵 일본 요소 클릭 중...`);
      await items[i].click();
      break;
    }
  }

  await page.waitForTimeout(3000);
  console.log(`📄 페이지: ${await page.title()}`);

  // 로밍망/로컬망 탭 찾기
  console.log('\n=== 망 탭 분석 ===');

  const tabSelectors = [
    'button[role="tab"]',
    '[role="tab"]',
    '.tab',
    '[class*="tab"]',
    'button:has-text("로밍망")',
    'button:has-text("로컬망")',
    'div:has-text("로밍망")',
    'div:has-text("로컬망")',
  ];

  for (const ts of tabSelectors) {
    try {
      const tabs = await page.locator(ts).all();
      if (tabs.length > 0) {
        console.log(`✅ ${ts}: ${tabs.length}개`);
        for (let i = 0; i < Math.min(tabs.length, 5); i++) {
          const text = await tabs[i].textContent();
          console.log(`   [${i}] "${text?.trim()}"`);
        }
      }
    } catch (e) {}
  }

  // 로컬망 탭 클릭
  console.log('\n=== 로컬망 탭으로 전환 ===');
  try {
    // 다양한 방식으로 로컬망 탭 찾기
    const localTab = await page.locator('button:has-text("로컬망"), div:has-text("로컬망"), [role="tab"]:has-text("로컬망")').first();
    if (await localTab.count() > 0) {
      const text = await localTab.textContent();
      console.log(`📡 로컬망 탭 클릭: "${text?.trim()}"`);
      await localTab.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('로컬망 탭을 찾지 못함');
    }
  } catch (e) {
    console.log('로컬망 탭 클릭 실패:', e.message);
  }

  // 상품 옵션 분석 (기간 선택, 데이터 선택 등)
  console.log('\n=== 상품 옵션 요소 분석 ===');

  // 기간 선택 버튼
  console.log('기간 선택 버튼:');
  const dayButtons = await page.locator('button:has-text("일"), div:has-text("일"), [class*="day"]:has-text("일")').all();
  if (dayButtons.length > 0) {
    console.log(`  발견된 기간 버튼: ${dayButtons.length}개`);
    for (let i = 0; i < Math.min(dayButtons.length, 10); i++) {
      const text = await dayButtons[i].textContent();
      console.log(`    [${i}] "${text?.trim()}"`);
    }
  }

  // 데이터량 선택 버튼
  console.log('\n데이터량 선택 버튼:');
  const dataButtons = await page.locator('button:has-text("GB"), button:has-text("MB"), button:has-text("무제한"), div:has-text("GB"), div:has-text("MB")').all();
  if (dataButtons.length > 0) {
    console.log(`  발견된 데이터 버튼: ${dataButtons.length}개`);
    for (let i = 0; i < Math.min(dataButtons.length, 10); i++) {
      const text = await dataButtons[i].textContent();
      console.log(`    [${i}] "${text?.trim()}"`);
    }
  }

  // 상품 카드/플랜 목록
  console.log('\n=== 상품 플랜 목록 분석 ===');

  const planSelectors = [
    '.plan-option',
    '.product-option',
    '[class*="option"]',
    '[class*="plan-item"]',
    '[class*="product-item"]',
    '.radio-group',
    '[role="radiogroup"]',
    '[type="radio"]',
  ];

  for (const ps of planSelectors) {
    try {
      const elements = await page.locator(ps).all();
      if (elements.length > 0) {
        console.log(`✅ ${ps}: ${elements.length}개`);
      }
    } catch (e) {}
  }

  // radio 요소 분석 (상품 선택은 radio로 구현되어 있을 가능성)
  console.log('\n=== Radio 버튼 분석 ===');
  const radios = await page.locator('input[type="radio"]').all();
  console.log(`발견된 radio: ${radios.length}개`);

  if (radios.length > 0) {
    for (let i = 0; i < Math.min(radios.length, 5); i++) {
      try {
        const value = await radios[i].getAttribute('value');
        const name = await radios[i].getAttribute('name');
        const id = await radios[i].getAttribute('id');
        const checked = await radios[i].isChecked();

        // 라벨 텍스트 찾기
        let labelText = '';
        try {
          if (id) {
            const label = page.locator(`label[for="${id}"]`);
            if (await label.count() > 0) {
              labelText = await label.textContent();
            }
          }
        } catch (e) {}

        console.log(`  [${i}] value="${value}", name="${name}", checked=${checked}`);
        if (labelText) {
          console.log(`      라벨: "${labelText?.trim()}"`);
        }
      } catch (e) {
        console.log(`  [${i}] 분석 실패`);
      }
    }
  }

  // 특정 상품 플랜 영역 찾기
  console.log('\n=== 상품 플랜 영역 상세 분석 ===');

  // 모든 버튼 요소 중에서 가격/데이터 관련 텍스트가 있는 것
  const allButtons = await page.locator('button, [role="button"]').all();
  console.log(`전체 버튼: ${allButtons.length}개`);

  const productButtons = [];
  for (const btn of allButtons) {
    try {
      const text = await btn.textContent();
      if (text && (text.includes('GB') || text.includes('MB') || text.includes('무제한') || text.includes('원'))) {
        productButtons.push(text.trim());
      }
    } catch (e) {}
  }

  console.log(`\n상품 관련 버튼 (${productButtons.length}개):`);
  for (const text of productButtons.slice(0, 15)) {
    console.log(`  - ${text}`);
  }

  // 가격 표시 영역 찾기
  console.log('\n=== 최종 가격 표시 영역 ===');
  const finalPriceSelectors = [
    '.final-price',
    '.total-price',
    '.display-price',
    '[class*="final"]',
    '[class*="total"]',
    '[class*="display"]',
  ];

  for (const fps of finalPriceSelectors) {
    try {
      const el = await page.locator(fps).first();
      if (await el.count() > 0) {
        const text = await el.textContent();
        console.log(`✅ ${fps}: "${text?.trim()}"`);
      }
    } catch (e) {}
  }

  // 모든 div에서 "원"으로 끝나는 텍스트
  console.log('\n=== "원"이 포함된 텍스트 요소 ===');
  const allDivs = await page.locator('div, span, p').all();
  const priceTexts = [];

  for (const div of allDivs) {
    try {
      const text = await div.textContent();
      if (text && text.includes('원') && text.trim().length < 50) {
        const className = await div.evaluate(e => e.className);
        priceTexts.push({ selector: `div.${className}`, text: text.trim() });
      }
    } catch (e) {}
  }

  // 중복 제거
  const uniquePrices = [...new Map(priceTexts.map(p => [p.text, p])).values()];
  console.log(`발견된 가격 텍스트 (${uniquePrices.length}개):`);
  for (const p of uniquePrices.slice(0, 20)) {
    console.log(`  ${p.text} (class: ${p.selector})`);
  }

  console.log('\n⏸️  30초 동안 대기합니다...');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('\n✅ 분석 완료!');
})();
