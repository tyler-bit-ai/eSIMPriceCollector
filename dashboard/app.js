const pageSize = 20;
let state = {
  items: [],
  filtered: [],
  currentPage: 1,
};

const el = {
  metaText: document.getElementById('metaText'),
  refreshBtn: document.getElementById('refreshBtn'),
  kpis: document.getElementById('kpis'),
  siteBars: document.getElementById('siteBars'),
  countryMin: document.getElementById('countryMin'),
  searchInput: document.getElementById('searchInput'),
  siteFilter: document.getElementById('siteFilter'),
  countryFilter: document.getElementById('countryFilter'),
  sortKey: document.getElementById('sortKey'),
  rows: document.getElementById('rows'),
  pageInfo: document.getElementById('pageInfo'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  downloadExcelBtn: document.getElementById('downloadExcelBtn'),
};

function won(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function safe(value) {
  return value ? String(value) : '-';
}

function isoToLocal(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ko-KR');
}

function pickSummary(items) {
  const bySite = {};
  const byCountry = {};
  const prices = [];

  for (const item of items) {
    const site = item.site || 'Unknown';
    const country = item.country || 'Unknown';
    const p = Number(item.price_numeric);

    bySite[site] = bySite[site] || { count: 0, minPrice: null };
    byCountry[country] = byCountry[country] || { count: 0, minPrice: null };

    bySite[site].count += 1;
    byCountry[country].count += 1;

    if (Number.isFinite(p)) {
      prices.push(p);
      bySite[site].minPrice = bySite[site].minPrice === null ? p : Math.min(bySite[site].minPrice, p);
      byCountry[country].minPrice = byCountry[country].minPrice === null ? p : Math.min(byCountry[country].minPrice, p);
    }
  }

  return {
    totalItems: items.length,
    siteCount: Object.keys(bySite).length,
    countryCount: Object.keys(byCountry).length,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    avgPrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
    bySite,
    byCountry,
  };
}

function renderKpis(summary) {
  const kpiDefs = [
    ['총 수집 항목', summary.totalItems.toLocaleString('ko-KR')],
    ['사이트 수', summary.siteCount],
    ['국가 수', summary.countryCount],
    ['최저가', won(summary.minPrice)],
    ['평균가', won(summary.avgPrice)],
    ['최고가', won(summary.maxPrice)],
  ];

  el.kpis.innerHTML = kpiDefs
    .map(([label, value]) => `<div class="kpi"><label>${label}</label><strong>${value}</strong></div>`)
    .join('');
}

function renderSiteBars(summary) {
  const entries = Object.entries(summary.bySite).sort((a, b) => b[1].count - a[1].count);
  const max = entries[0] ? entries[0][1].count : 1;

  el.siteBars.innerHTML = entries
    .map(([site, info]) => {
      const width = Math.round((info.count / max) * 100);
      return `
        <div class="barRow">
          <div class="barHead"><span>${site}</span><span>${info.count}개</span></div>
          <div class="track"><div class="fill" style="width:${width}%"></div></div>
        </div>
      `;
    })
    .join('');
}

function renderCountryMin(summary) {
  const entries = Object.entries(summary.byCountry).sort((a, b) => a[0].localeCompare(b[0]));
  el.countryMin.innerHTML = entries
    .map(([country, info]) => `<div class="listItem"><span>${country}</span><strong>${won(info.minPrice)}</strong></div>`)
    .join('');
}

function renderFilterOptions(items) {
  const sites = [...new Set(items.map((it) => it.site).filter(Boolean))].sort();
  const countries = [...new Set(items.map((it) => it.country).filter(Boolean))].sort();

  el.siteFilter.innerHTML = '<option value="">전체 사이트</option>' + sites.map((s) => `<option>${s}</option>`).join('');
  el.countryFilter.innerHTML = '<option value="">전체 국가</option>' + countries.map((c) => `<option>${c}</option>`).join('');
}

function updateDownloadButton() {
  const count = state.filtered.length;
  el.downloadExcelBtn.disabled = count === 0;
  el.downloadExcelBtn.textContent = count > 0 ? `엑셀 다운로드 (${count.toLocaleString('ko-KR')}개)` : '엑셀 다운로드';
}

function applyFilters() {
  const q = el.searchInput.value.trim().toLowerCase();
  const site = el.siteFilter.value;
  const country = el.countryFilter.value;
  const sort = el.sortKey.value;

  const out = state.items.filter((item) => {
    if (site && item.site !== site) return false;
    if (country && item.country !== country) return false;

    if (!q) return true;

    const bag = [item.site, item.country, item.network_type, item.product_name, item.data_amount, item.price]
      .join(' ')
      .toLowerCase();

    return bag.includes(q);
  });

  if (sort === 'priceAsc') {
    out.sort((a, b) => (a.price_numeric ?? Number.MAX_SAFE_INTEGER) - (b.price_numeric ?? Number.MAX_SAFE_INTEGER));
  } else if (sort === 'priceDesc') {
    out.sort((a, b) => (b.price_numeric ?? -1) - (a.price_numeric ?? -1));
  } else {
    out.sort((a, b) => new Date(b.crawled_at || 0) - new Date(a.crawled_at || 0));
  }

  state.filtered = out;
  state.currentPage = 1;
  renderTable();
  updateDownloadButton();
}

function renderTable() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  const start = (state.currentPage - 1) * pageSize;
  const pageRows = state.filtered.slice(start, start + pageSize);

  el.rows.innerHTML = pageRows
    .map((row) => `
      <tr>
        <td>${safe(row.site)}</td>
        <td>${safe(row.country)}</td>
        <td>${safe(row.network_type)}</td>
        <td>${safe(row.product_name)}</td>
        <td>${safe(row.data_amount)}</td>
        <td>${safe(row.price)}</td>
        <td>${isoToLocal(row.crawled_at)}</td>
      </tr>
    `)
    .join('');

  el.pageInfo.textContent = `${state.currentPage} / ${totalPages} (총 ${state.filtered.length.toLocaleString('ko-KR')}개)`;
  el.prevPage.disabled = state.currentPage <= 1;
  el.nextPage.disabled = state.currentPage >= totalPages;
}

async function downloadFilteredExcel() {
  const params = new URLSearchParams();

  const q = el.searchInput.value.trim();
  const site = el.siteFilter.value;
  const country = el.countryFilter.value;
  const sort = el.sortKey.value;

  if (q) params.set('q', q);
  if (site) params.set('site', site);
  if (country) params.set('country', country);
  if (sort) params.set('sort', sort);

  const qs = params.toString();
  const url = qs ? `/api/export.xlsx?${qs}` : '/api/export.xlsx';

  try {
    el.downloadExcelBtn.disabled = true;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body && body.message) message = body.message;
      } catch (_) {
        // noop
      }
      throw new Error(message);
    }

    const blob = await res.blob();
    const contentDisposition = res.headers.get('content-disposition') || '';
    let filename = 'esim_detail_filtered.xlsx';
    const match = contentDisposition.match(/filename="([^"]+)"/i);
    if (match && match[1]) {
      filename = match[1];
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    alert(`엑셀 다운로드 실패: ${err.message}`);
  } finally {
    updateDownloadButton();
  }
}

async function loadData() {
  const res = await fetch('/api/latest', { cache: 'no-store' });
  const data = await res.json();

  if (!data.found) {
    el.metaText.textContent = data.message;
    state.items = [];
    state.filtered = [];
    renderKpis(pickSummary([]));
    renderSiteBars(pickSummary([]));
    renderCountryMin(pickSummary([]));
    renderTable();
    updateDownloadButton();
    return;
  }

  state.items = data.items;
  const summary = pickSummary(state.items);

  el.metaText.textContent = `파일: ${data.file} | 생성: ${isoToLocal(data.generatedAt)} | 총 ${summary.totalItems.toLocaleString('ko-KR')}개`;

  renderKpis(summary);
  renderSiteBars(summary);
  renderCountryMin(summary);
  renderFilterOptions(state.items);
  applyFilters();
}

el.searchInput.addEventListener('input', applyFilters);
el.siteFilter.addEventListener('change', applyFilters);
el.countryFilter.addEventListener('change', applyFilters);
el.sortKey.addEventListener('change', applyFilters);
el.refreshBtn.addEventListener('click', loadData);
el.downloadExcelBtn.addEventListener('click', downloadFilteredExcel);
el.prevPage.addEventListener('click', () => {
  state.currentPage = Math.max(1, state.currentPage - 1);
  renderTable();
});
el.nextPage.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / pageSize));
  state.currentPage = Math.min(totalPages, state.currentPage + 1);
  renderTable();
});

loadData().catch((err) => {
  el.metaText.textContent = `데이터 로드 실패: ${err.message}`;
  updateDownloadButton();
});
