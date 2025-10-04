// scripts/geocode-stores.js
require('dotenv').config();
const sql = require('mssql');

const USE_GOOGLE = !!process.env.GOOGLE_MAPS_KEY; // bạn không bật → dùng OSM
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const DEFAULT_CITY = process.env.DEFAULT_CITY || 'Ho Chi Minh City';
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || 'Vietnam';
const NOMINATIM_EMAIL = process.env.NOMINATIM_EMAIL || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bỏ dấu tiếng Việt */
function stripDiacritics(s = '') {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Nới rộng viết tắt VN và chuẩn hoá 1 số cụm phổ biến */
function expandVNAbbr(s = '') {
  let t = s;
  t = t.replace(/\bP\.\s*/gi, 'Phường ');
  t = t.replace(/\bQ\.\s*/gi, 'Quận ');
  t = t.replace(/\bTP\.\s*/gi, 'Thành phố ');
  t = t.replace(/\bTPHCM\b|HCM\b/gi, 'Thành phố Hồ Chí Minh');
  t = t.replace(/\bTP\.\s*Hồ\s*Chí\s*Minh\b/gi, 'Thành phố Hồ Chí Minh');
  t = t.replace(/\bBen Nghe\b/gi, 'Bến Nghé');
  return t;
}

/** Chuẩn hóa địa chỉ: bù city/country nếu thiếu */
function normalizeAddr(a) {
  let s = (a || '').trim();
  if (!s) return s;
  const hasCountry = /viet\s*nam|việt\s*nam/i.test(s);
  const hasCity = new RegExp(DEFAULT_CITY.replace(/\s+/g, '\\s*'), 'i').test(s);
  if (!hasCity) s = `${s}, ${DEFAULT_CITY}`;
  if (!hasCountry) s = `${s}, ${DEFAULT_COUNTRY}`;
  return s;
}

/** Bỏ số nhà ở đầu (dùng khi OSM không match house number) */
function dropHouseNumber(s = '') {
  return s.replace(/^\s*\d+[\-\w]*\s+/, ''); // "80 " hoặc "80-82 "
}

/** Tách thành phần địa chỉ để dùng structured search của Nominatim */
function parseVNAddress(raw = '') {
  const a = expandVNAbbr(raw);
  const noBreaks = a.replace(/\s+/g, ' ').trim();

  // Lấy cụm đầu trước dấu phẩy làm street
  const streetPart = noBreaks.split(',')[0] || '';
  const street = streetPart.trim();

  // Tìm District (Quận N)
  let district = '';
  const mQ = noBreaks.match(/\bQuận\s*(\d+)\b/i);
  if (mQ) district = `District ${mQ[1]}`;

  // City
  let city = '';
  if (/Thành phố Hồ Chí Minh/i.test(noBreaks) || /Ho Chi Minh City/i.test(noBreaks)) {
    city = 'Ho Chi Minh City';
  }

  // Country
  const country = 'Vietnam';

  return { street, district, city, country };
}

/** Gợi ý theo tên phố (case hay MISS) */
function streetHintFromName(name = '') {
  const n = stripDiacritics(name).toLowerCase();
  if (n.includes('nguyen hue')) return 'Nguyễn Huệ, Quận 1';
  if (n.includes('le loi') || n.includes('lê lợi')) return 'Lê Lợi, Quận 1';
  return null;
}

/** Nếu Address mơ hồ → dùng Name (bỏ “Phúc Long”) */
function pickBestQuery(store) {
  const addr = (store.Address || '').trim();
  const name = (store.Name || '')
    .trim()
    .replace(/^Phúc\s*Long\s*/i, '')
    .replace(/^Phuc\s*Long\s*/i, '');
  const looksWeak =
    addr.length < 12 ||
    !/[0-9]|Quận|District|Phường|Ward|TP\.|Thành phố|Q\.\s*\d+/i.test(addr);
  return looksWeak ? name : addr;
}

/** Structured search với Nominatim */
async function geocodeStructured({ street, district, city, country }) {
  const emailParam = NOMINATIM_EMAIL ? `&email=${encodeURIComponent(NOMINATIM_EMAIL)}` : '';
  const params = new URLSearchParams();
  if (street) params.set('street', street);
  if (city) params.set('city', city);
  if (district) params.set('county', district); // Nominatim dùng county cho quận/huyện
  if (country) params.set('country', country);
  params.set('format', 'json');
  params.set('limit', '1');

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}${emailParam}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'PhucLongBE-Geocoder/1.0 (+non-commercial)' },
  });
  const j = await r.json();
  if (Array.isArray(j) && j[0]) {
    return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
  }
  return null;
}

/** Geocode với nhiều biến thể + structured + fallback đặc trị */
async function geocode(addrRaw, nameHint = '') {
  const expanded = expandVNAbbr(addrRaw);
  const a1 = normalizeAddr(expanded); // gốc (đã expand)
  const a2 = normalizeAddr(stripDiacritics(expanded)); // không dấu
  const a3 = normalizeAddr(expanded)
    .replace(/\bQuận\s*1\b/gi, 'District 1')
    .replace(/Thành phố Hồ Chí Minh/gi, 'Ho Chi Minh City'); // English
  const hint = streetHintFromName(nameHint);
  const a4 = hint ? normalizeAddr(hint) : null;

  // Nếu có số nhà mà vẫn không ra: thử bỏ số nhà, chỉ street
  const a5 = normalizeAddr(dropHouseNumber(expanded));
  const a6 = normalizeAddr(stripDiacritics(dropHouseNumber(expanded)))
    .replace(/\bQuan\s*1\b/gi, 'District 1')
    .replace(/Thanh pho Ho Chi Minh/gi, 'Ho Chi Minh City');

  const tries = [a1, a2, a3, a4, a5, a6].filter(Boolean);
  if (DEBUG) console.log('→ tries:', tries);

  // 1) Text search theo nhiều biến thể
  for (const q of tries) {
    try {
      if (USE_GOOGLE) continue; // bạn không dùng Google
      const emailParam = NOMINATIM_EMAIL ? `&email=${encodeURIComponent(NOMINATIM_EMAIL)}` : '';
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&limit=1${emailParam}`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'PhucLongBE-Geocoder/1.0 (+non-commercial)' },
      });
      const j = await r.json();
      if (j[0]) return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
    } catch (e) {
      if (DEBUG) console.error('Geocode try failed:', q, e.message);
    }
  }

  // 2) Structured search: street/city/county/country
  try {
    const parsed = parseVNAddress(addrRaw);
    if (!parsed.city) parsed.city = DEFAULT_CITY === 'Ho Chi Minh City' ? 'Ho Chi Minh City' : DEFAULT_CITY;
    if (!parsed.country) parsed.country = DEFAULT_COUNTRY || 'Vietnam';

    // Thử 2 kiểu: có quận & bỏ nhà số
    const s1 = await geocodeStructured(parsed);
    if (s1) return s1;

    const parsedNoHouse = { ...parsed, street: dropHouseNumber(parsed.street) };
    const s2 = await geocodeStructured(parsedNoHouse);
    if (s2) return s2;
  } catch (e) {
    if (DEBUG) console.error('Structured geocode failed:', e.message);
  }

  // 3) Fallback đặc trị: Nguyễn Huệ (tâm phố đi bộ, Quận 1)
  const nameNoTone = stripDiacritics(nameHint).toLowerCase();
  if (nameNoTone.includes('nguyen hue')) {
    if (DEBUG) console.warn('Using hard fallback for Nguyen Hue');
    return { lat: 10.7729, lng: 106.7043 }; // tâm Nguyễn Huệ, Q1
  }

  return null;
}

function buildDbConfigFromEnv() {
  const cfg = {
    user: process.env.DB_USER || 'phuclong_user',
    password: process.env.DB_PASSWORD || 'StrongPass123!',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'PhucLongDB',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  };
  if (process.env.DB_INSTANCE && process.env.DB_INSTANCE.trim()) {
    cfg.options.instanceName = process.env.DB_INSTANCE.trim();
  } else {
    cfg.port = parseInt(process.env.DB_PORT || '1433', 10);
  }
  return cfg;
}

(async () => {
  let pool;
  try {
    if (DEBUG) {
      console.log('ENV check:', {
        hasConn: !!process.env.SQLSERVER_CONN,
        DB_USER: process.env.DB_USER,
        DB_SERVER: process.env.DB_SERVER,
        DB_PORT: process.env.DB_PORT,
        DB_INSTANCE: process.env.DB_INSTANCE,
        DEFAULT_CITY,
        DEFAULT_COUNTRY,
        NOMINATIM_EMAIL,
      });
    }

    const connString = process.env.SQLSERVER_CONN && process.env.SQLSERVER_CONN.trim();
    pool = connString ? await sql.connect(connString) : await sql.connect(buildDbConfigFromEnv());
    if (DEBUG) console.log('✅ SQL connected');

    const batchSize = parseInt(process.env.GEOCODE_BATCH || '50', 10);

    while (true) {
      const { recordset: rows } = await pool.request().query(`
        SELECT TOP (${batchSize}) Id, Name, Address
        FROM dbo.Stores
        WHERE (Lat IS NULL OR Lng IS NULL) AND ISNULL(Address,'') <> ''
        ORDER BY Id ASC
      `);

      if (!rows || rows.length === 0) break;

      for (const s of rows) {
        try {
          const base = pickBestQuery(s);
          if (DEBUG) console.log('→ Base:', base, '| Name:', s.Name);
          const c = await geocode(base, s.Name);
          if (c) {
            await pool
              .request()
              .input('Id', sql.Int, s.Id)
              .input('Lat', sql.Float, c.lat)
              .input('Lng', sql.Float, c.lng)
              .query(`UPDATE dbo.Stores SET Lat=@Lat, Lng=@Lng WHERE Id=@Id;`);
            console.log(`OK #${s.Id} "${s.Name}" -> ${c.lat}, ${c.lng}`);
          } else {
            console.log(`MISS #${s.Id} "${s.Name}"`);
          }
        } catch (rowErr) {
          console.error(`❌ Row #${s.Id} failed:`, rowErr.message);
          if (DEBUG) console.error(rowErr);
        }
        await sleep(1100); // OSM rate-limit
      }
    }

    console.log('Geocode done.');
  } catch (err) {
    console.error('❌ Geocode script failed:', err.message);
    if (DEBUG) console.error(err);
    process.exitCode = 1;
  } finally {
    try { if (pool) await pool.close(); } catch {}
  }
})();
