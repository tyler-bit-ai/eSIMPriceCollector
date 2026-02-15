const fs = require('fs');
const path = require('path');
const http = require('http');
const xlsx = require('xlsx');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;
const ROOT = __dirname;
const DASHBOARD_DIR = path.join(ROOT, 'dashboard');
const eucKrDecoder = new TextDecoder('euc-kr');

function parsePrice(value) {
  const numeric = String(value || '').replace(/[^\d]/g, '');
  return numeric ? Number(numeric) : null;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  fields.push(current);
  return fields;
}

function parseCsv(content) {
  const clean = content.replace(/^\uFEFF/, '').replace(/\r/g, '');
  const lines = clean.split('\n').filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0) {
      continue;
    }

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = (cols[idx] || '').trim();
    });

    row.price_numeric = parsePrice(row.price);
    rows.push(row);
  }

  return rows;
}

function countChar(text, char) {
  let count = 0;
  for (const ch of text) {
    if (ch === char) {
      count += 1;
    }
  }
  return count;
}

function decodeCsvBuffer(buffer) {
  const utf8Text = buffer.toString('utf8');
  const utf8ReplacementCount = countChar(utf8Text, '\uFFFD');

  if (utf8ReplacementCount === 0) {
    return utf8Text;
  }

  const eucKrText = eucKrDecoder.decode(buffer);
  const eucKrReplacementCount = countChar(eucKrText, '\uFFFD');
  return eucKrReplacementCount < utf8ReplacementCount ? eucKrText : utf8Text;
}

function getLatestResultFile() {
  const files = fs
    .readdirSync(ROOT)
    .filter((name) => /^esim_prices_.*\.csv$/i.test(name))
    .map((name) => {
      const fullPath = path.join(ROOT, name);
      const stat = fs.statSync(fullPath);
      return { name, fullPath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0] || null;
}

function summarize(items) {
  const summary = {
    totalItems: items.length,
    minPrice: null,
    maxPrice: null,
    avgPrice: null,
    siteCount: 0,
    countryCount: 0,
    bySite: {},
    byCountry: {},
  };

  const prices = items.map((item) => item.price_numeric).filter((p) => Number.isFinite(p));

  if (prices.length > 0) {
    summary.minPrice = Math.min(...prices);
    summary.maxPrice = Math.max(...prices);
    summary.avgPrice = Math.round(prices.reduce((acc, n) => acc + n, 0) / prices.length);
  }

  for (const item of items) {
    const site = item.site || 'Unknown';
    const country = item.country || 'Unknown';

    if (!summary.bySite[site]) {
      summary.bySite[site] = { count: 0, minPrice: null };
    }
    if (!summary.byCountry[country]) {
      summary.byCountry[country] = { count: 0, minPrice: null };
    }

    summary.bySite[site].count += 1;
    summary.byCountry[country].count += 1;

    if (Number.isFinite(item.price_numeric)) {
      const sMin = summary.bySite[site].minPrice;
      const cMin = summary.byCountry[country].minPrice;
      summary.bySite[site].minPrice = sMin === null ? item.price_numeric : Math.min(sMin, item.price_numeric);
      summary.byCountry[country].minPrice = cMin === null ? item.price_numeric : Math.min(cMin, item.price_numeric);
    }
  }

  summary.siteCount = Object.keys(summary.bySite).length;
  summary.countryCount = Object.keys(summary.byCountry).length;
  return summary;
}

function applyFiltersAndSort(items, filters) {
  const q = String(filters.q || '').trim().toLowerCase();
  const site = String(filters.site || '').trim();
  const country = String(filters.country || '').trim();
  const sort = String(filters.sort || 'latest').trim();

  const out = items.filter((item) => {
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

  return out;
}

function makeExportFilename() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `esim_detail_filtered_${ts}.xlsx`;
}

function sendExcel(res, items) {
  const exportRows = items.map((row) => ({
    site: row.site || '',
    country: row.country || '',
    network_type: row.network_type || '',
    product_name: row.product_name || '',
    data_amount: row.data_amount || '',
    price: row.price || '',
    crawled_at: row.crawled_at || '',
  }));

  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(exportRows, {
    header: ['site', 'country', 'network_type', 'product_name', 'data_amount', 'price', 'crawled_at'],
  });
  xlsx.utils.book_append_sheet(workbook, worksheet, 'details');

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const filename = makeExportFilename();

  res.writeHead(200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store',
  });
  res.end(buffer);
}

function readLatestData() {
  const latest = getLatestResultFile();
  if (!latest) {
    return {
      found: false,
      message: 'No crawl result found. Run `npm start` first.',
      file: null,
      generatedAt: null,
      items: [],
      summary: summarize([]),
    };
  }

  const rawBuffer = fs.readFileSync(latest.fullPath);
  const raw = decodeCsvBuffer(rawBuffer);
  const items = parseCsv(raw);

  return {
    found: true,
    file: latest.name,
    generatedAt: new Date(latest.mtimeMs).toISOString(),
    items,
    summary: summarize(items),
  };
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function serveStatic(reqPath, res) {
  const safePath = reqPath === '/' ? '/index.html' : reqPath;
  const fullPath = path.join(DASHBOARD_DIR, safePath);

  if (!fullPath.startsWith(DASHBOARD_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = mime[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(fullPath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/latest') {
    sendJson(res, 200, readLatestData());
    return;
  }

  if (url.pathname === '/api/export.xlsx') {
    const data = readLatestData();
    if (!data.found) {
      sendJson(res, 404, { ok: false, message: data.message });
      return;
    }

    const items = applyFiltersAndSort(data.items, {
      q: url.searchParams.get('q') || '',
      site: url.searchParams.get('site') || '',
      country: url.searchParams.get('country') || '',
      sort: url.searchParams.get('sort') || 'latest',
    });
    sendExcel(res, items);
    return;
  }

  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
  console.log('If no data appears, run `npm start` to generate result files.');
});
