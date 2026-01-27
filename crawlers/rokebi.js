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

      // 로밍망 & 로컬망 처리
      const networkTypes = [
        { type: 'roaming', code: categories.roaming, name: '로밍망' },
        { type: 'local', code: categories.local, name: '로컬망' }
      ];

      for (const network of networkTypes) {
        if (!network.code) continue;

        try {
          const url = `https://www.rokebi.com/store?tab=best&categoryItem=${network.code}`;
          console.log(`    ${network.name} URL: ${url}`);

          // 페이지 로드
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
          await page.waitForTimeout(5000);

          // 팝업 닫기 (여러 팝업이 뜰 수 있으므로 반복)
          for (let i = 0; i < 3; i++) {
            try {
              const closeButtons = await page.locator('button:has-text("확인"), button:has-text("닫기"), .ant-modal-close, .ant-notification-close-button').all();
              for (const btn of closeButtons) {
                if (await btn.isVisible()) {
                  await btn.click();
                  await page.waitForTimeout(1000);
                }
              }
            } catch (e) {
              // 무시
            }
          }

          // 스크롤해서 모든 상품 로드
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(2000);
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
          await page.waitForTimeout(2000);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(2000);

          // 상품 요소 찾기
          const productSelectors = [
            '.ant-card',
            '[class*="ProductCard"]',
            '[class*="product-card"]',
            '.ant-col'
          ];

          let productElements = [];
          for (const selector of productSelectors) {
            try {
              const found = await page.locator(selector).all();
              if (found.length > 0) {
                console.log(`    찾은 요소 (${selector}): ${found.length}개`);
                productElements = found;
                break;
              }
            } catch (e) {}
          }

          // 각 상품 클릭하고 정보 추출
          for (const product of productElements) {
            try {
              // 상품이 보이는지 확인
              if (!await product.isVisible()) continue;

              // 상품 미리보기 텍스트 가져오기
              const previewText = await product.textContent();
              if (!previewText || previewText.length < 5) continue;

              // 상품 클릭
              await product.click();
              await page.waitForTimeout(2000);

              // 사이드바/모달에서 상세 정보 추출
              let detailInfo = '';

              try {
                // 다양한 상세 정보 위치 시도
                const detailSelectors = [
                  '.ant-drawer-content',
                  '.ant-modal-content',
                  '[class*="detail"]',
                  '[class*="sidebar"]',
                  '[class*="panel"]'
                ];

                for (const selector of detailSelectors) {
                  try {
                    const detailElement = await page.locator(selector).first();
                    if (await detailElement.count() > 0) {
                      detailInfo = await detailElement.textContent();
                      if (detailInfo && detailInfo.length > 10) {
                        break;
                      }
                    }
                  } catch (e) {}
                }
              } catch (e) {
                // 상세 정보를 가져오지 못하면 미리보기 정보 사용
                detailInfo = previewText;
              }

              // 결합된 텍스트에서 정보 추출
              const combinedText = previewText + ' ' + detailInfo;

              // 가격 추출
              const priceMatch = combinedText.match(/(\d{1,2},?\d{3})원/);
              if (!priceMatch) {
                // 닫기 버튼 클릭 후 다음 상품으로
                try {
                  await page.locator('.ant-drawer-close, .ant-modal-close, button:has-text("닫기")').first().click();
                  await page.waitForTimeout(1000);
                } catch (e) {}
                continue;
              }

              const price = priceMatch[1] + '원';

              // 데이터량 추출
              let dataAmount = '';
              if (combinedText.includes('무제한')) {
                dataAmount = '무제한';
              } else {
                const dataMatch = combinedText.match(/(\d+[GM]B)/);
                if (dataMatch) {
                  dataAmount = dataMatch[1];
                }
              }

              // 기간 추출 (4일 기준)
              const dayMatch = combinedText.match(/(\d+)일/);
              if (dayMatch && dayMatch[1] !== '4') {
                // 4일이 아니면 닫고 다음으로
                try {
                  await page.locator('.ant-drawer-close, .ant-modal-close, button:has-text("닫기")').first().click();
                  await page.waitForTimeout(1000);
                } catch (e) {}
                continue;
              }

              allProducts.push({
                country,
                network_type: network.name,
                product_name: `로밍도깨비 ${country} 4일`,
                data_amount: dataAmount,
                price,
                validity_period: '4일',
                crawled_at: new Date().toISOString()
              });

              // 닫기 버튼 클릭
              try {
                await page.locator('.ant-drawer-close, .ant-modal-close, button:has-text("닫기")').first().click();
                await page.waitForTimeout(1000);
              } catch (e) {}

            } catch (e) {
              // 에러 발생 시 닫기 시도
              try {
                await page.locator('.ant-drawer-close, .ant-modal-close, button:has-text("닫기")').first().click();
                await page.waitForTimeout(1000);
              } catch (e2) {}
            }
          }

          const count = allProducts.filter(p => p.country === country && p.network_type === network.name).length;
          console.log(`    ✅ ${country} ${network.name}: ${count}개`);

        } catch (e) {
          console.log(`    ❌ ${country} ${network.name} 수집 실패: ${e.message}`);
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
