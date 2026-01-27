const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// 크롤러 모듈 로드
const usimsa = require('./crawlers/usimsa');
const pindirect = require('./crawlers/pindirect');
const dosirak = require('./crawlers/dosirak');
const maaltalk = require('./crawlers/maaltalk');
const rokebi = require('./crawlers/rokebi');

// 크롤러 목록
const crawlers = [
  usimsa,
  pindirect,
  dosirak,
  maaltalk,
  rokebi
];

// 크롤링할 국가 목록
const COUNTRIES = ['일본', '베트남', '필리핀'];

// 데이터 기준 (4일 사용)
const DATA_CRITERIA_DAYS = 4;

/**
 * 4일 기준 데이터 필터링 및 기간 정보 추가
 */
function filterBy4Days(data) {
  return data.map(item => {
    // 기간 정보 추출
    const text = (item.product_name || '') + ' ' + (item.data_amount || '');
    const dayMatch = text.match(/(\d+)일/);

    // validity_period 필드 추가
    if (dayMatch) {
      item.validity_period = `${dayMatch[1]}일`;
    } else if (!item.validity_period) {
      item.validity_period = `${DATA_CRITERIA_DAYS}일`; // 기본값
    }

    return item;
  }).filter(item => {
    // 4일 기준 필터링
    const dayMatch = (item.validity_period || '').match(/(\d+)일/);
    if (!dayMatch) {
      return true; // 일수 정보가 없으면 포함
    }

    return parseInt(dayMatch[1]) === DATA_CRITERIA_DAYS;
  });
}

/**
 * CSV 파일 저장
 */
function saveToCSV(data, filename) {
  if (data.length === 0) {
    console.log('⚠️ 저장할 데이터가 없습니다.');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  fs.writeFileSync(filename, '\uFEFF' + csvContent, 'utf8');
  console.log(`✅ CSV 저장: ${filename} (${data.length}개)`);
}

/**
 * 엑셀 파일 저장
 */
function saveToExcel(allData, filename) {
  if (allData.length === 0) {
    console.log('⚠️ 저장할 데이터가 없습니다.');
    return;
  }

  // 워크북 생성
  const workbook = xlsx.utils.book_new();

  // 1. 전체 시트 (모든 데이터)
  const allSheet = xlsx.utils.json_to_sheet(allData);
  xlsx.utils.book_append_sheet(workbook, allSheet, '전체');

  // 2. 사이트별 시트
  const sites = ['USIMSA (유심사)', 'PinDirect (핀다이렉트)', 'Dosirak (도시락eSIM)', 'Maaltalk (말톡)', 'Rokebi (로밍도깨비)'];
  sites.forEach(site => {
    const siteData = allData.filter(row => row.product_name.includes(site.split(' ')[0]) ||
                                        (site === 'USIMSA (유심사)' && !row.product_name.includes('핀다이렉트') && !row.product_name.includes('도시락') && !row.product_name.includes('말톡')));

    if (siteData.length > 0) {
      const sheet = xlsx.utils.json_to_sheet(siteData);
      const sheetName = site.replace(/\s*\(.*\)/, '').substring(0, 31); // 엑셀 시트명은 최대 31자
      xlsx.utils.book_append_sheet(workbook, sheet, sheetName);
    }
  });

  // 3. 국가별 시트
  COUNTRIES.forEach(country => {
    const countryData = allData.filter(row => row.country === country);
    if (countryData.length > 0) {
      const sheet = xlsx.utils.json_to_sheet(countryData);
      xlsx.utils.book_append_sheet(workbook, sheet, country);
    }
  });

  // 4. 요약 시트
  const summary = [];
  // 4일 기준 안내 추가
  summary.push({
    '사이트': `※ ${DATA_CRITERIA_DAYS}일 사용 기준`,
    '국가': '',
    '상품 수': '',
    '최저가': '',
    '최고가': ''
  });
  summary.push({}); // 빈 행 추가

  sites.forEach(site => {
    COUNTRIES.forEach(country => {
      const siteName = site.split(' ')[0];
      const siteData = allData.filter(row => {
        const isSite = row.product_name.includes(siteName) ||
                      (siteName === 'USIMSA' && !row.product_name.includes('핀다이렉트') && !row.product_name.includes('도시락') && !row.product_name.includes('말톡') && !row.product_name.includes('로밍도깨비'));
        return isSite && row.country === country;
      });

      if (siteData.length > 0) {
        summary.push({
          '사이트': site,
          '국가': country,
          '상품 수': siteData.length,
          '최저가': siteData.reduce((min, p) => {
            const price = parseInt(p.price.replace(/[,원]/g, ''));
            return !min || price < min ? price : min;
          }, null) + '원',
          '최고가': siteData.reduce((max, p) => {
            const price = parseInt(p.price.replace(/[,원]/g, ''));
            return !max || price > max ? price : max;
          }, null) + '원'
        });
      }
    });
  });

  if (summary.length > 0) {
    const summarySheet = xlsx.utils.json_to_sheet(summary);
    xlsx.utils.book_append_sheet(workbook, summarySheet, '요약');
  }

  // 파일 저장
  xlsx.writeFile(workbook, filename);
  console.log(`✅ 엑셀 저장: ${filename}`);
  console.log(`   - 전체: ${allData.length}개 상품 (${DATA_CRITERIA_DAYS}일 기준)`);
  console.log(`   - 시트: 전체, ${sites.map(s => s.replace(/\s*\(.*\)/, '')).join(', ')}, ${COUNTRIES.join(', ')}, 요약`);
}

/**
 * 결과 출력
 */
function printResults(allData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 크롤링 결과 요약');
  console.log('='.repeat(60));

  const sites = ['USIMSA', 'PinDirect', 'Dosirak', 'Maaltalk', 'Rokebi'];

  sites.forEach(site => {
    const siteData = allData.filter(row => row.product_name.includes(site));
    if (siteData.length > 0) {
      console.log(`\n${site}:`);
      COUNTRIES.forEach(country => {
        const countryData = siteData.filter(row => row.country === country);
        if (countryData.length > 0) {
          const minPrice = countryData.reduce((min, p) => {
            const price = parseInt(p.price.replace(/[,원]/g, ''));
            return !min || price < min ? price : min;
          }, null);
          console.log(`  ${country}: ${countryData.length}개 (최저가: ${minPrice}원)`);
        }
      });
    }
  });

  console.log(`\n총 상품 수: ${allData.length}개`);
  console.log('='.repeat(60));
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 eSIM 가격 비교 크롤러 시작\n');
  console.log(`대상 사이트: ${crawlers.length}개`);
  console.log(`대상 국가: ${COUNTRIES.join(', ')}`);
  console.log(`데이터 기준: 4일 사용 요금제`);
  console.log('');

  const allData = [];
  const startTime = Date.now();

  // 각 크롤러 실행
  for (const crawler of crawlers) {
    try {
      console.log(`\n${'─'.repeat(60)}`);
      const data = await crawler.crawl(COUNTRIES);

      // 각 상품에 사이트명 추가
      const dataWithSite = data.map(item => ({
        ...item,
        site: crawler.name
      }));

      allData.push(...dataWithSite);
    } catch (error) {
      console.error(`❌ ${crawler.name} 크롤링 실패:`, error.message);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // 4일 기준 필터링
  console.log(`\n🔍 ${DATA_CRITERIA_DAYS}일 기준 데이터 필터링 중...`);
  const filteredData = filterBy4Days(allData);
  console.log(`   원본 데이터: ${allData.length}개`);
  console.log(`   필터링 후: ${filteredData.length}개`);

  // 결과 출력
  printResults(filteredData);

  // 파일 저장
  console.log(`\n💾 결과 파일 저장 중...`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

  // CSV 저장
  const csvPath = path.join(__dirname, `esim_prices_${timestamp}.csv`);
  saveToCSV(filteredData, csvPath);

  // 엑셀 저장
  const excelPath = path.join(__dirname, `esim_prices_${timestamp}.xlsx`);
  saveToExcel(filteredData, excelPath);

  // 완료 메시지
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 모든 작업 완료!');
  console.log(`총 소요 시간: ${duration}초`);
  console.log(`총 수집 상품: ${filteredData.length}개 (${DATA_CRITERIA_DAYS}일 기준)`);
  console.log('='.repeat(60));
}

// 실행
main().catch(error => {
  console.error('❌ 치명적 오류:', error);
  process.exit(1);
});
