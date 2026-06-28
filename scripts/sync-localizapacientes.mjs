/**
 * sync-localizapacientes.mjs
 * Importa localizapacientes.com → Supabase patients
 * Usa Playwright para bypassear el 403 e interceptar la API interna.
 * Luego corre auto-matching contra missing_persons (score >= 0.78).
 */

import { chromium } from 'playwright';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

process.env.PLAYWRIGHT_BROWSERS_PATH = '/var/www/venezuelaselevanta/scripts/.browsers';

// ── Cargar .env del proyecto ───────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve('/var/www/venezuelaselevanta/.env');
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* .env no disponible, usar variables del entorno */ }
}
loadEnv();

// ── Configuración ──────────────────────────────────────────────────────────
const OUR_URL   = process.env.SUPABASE_URL || 'https://advebubtfjgxwpjxprok.supabase.co';
const ANON_KEY  = process.env.SUPABASE_PUBLISHABLE_KEY;
const SVC_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY || !SVC_KEY) {
  console.error('❌ Faltan SUPABASE_PUBLISHABLE_KEY o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const SITE_URL    = 'https://localizapacientes.com';
const SOURCE_URL  = 'localizapacientes.com';
const SOURCE_LABEL = 'localizapacientes.com';
const BATCH_SIZE  = 100;
const AUTO_MATCH_THRESHOLD = 0.78;

// anon para lecturas, service_role para escrituras y auto-match
const supabaseAnon = createClient(OUR_URL, ANON_KEY, { realtime: { transport: ws } });
const supabaseSvc  = createClient(OUR_URL, SVC_KEY,  { realtime: { transport: ws } });

// ── Coordenadas de hospitales venezolanos ─────────────────────────────────
const HOSPITAL_COORDS = [
  // La Guaira / Vargas
  { pat: /hospital.*guaira|guaira.*hospital/i,           lat: 10.6005, lng: -66.9332 },
  { pat: /hospital.*maiquetía|maiquetia/i,               lat: 10.5993, lng: -67.0051 },
  { pat: /hospital.*rafael\s*calvo|calvo/i,              lat: 10.5993, lng: -67.0051 },
  { pat: /catia\s*la\s*mar/i,                            lat: 10.6013, lng: -67.0366 },
  // Caracas
  { pat: /hospital.*universitario.*caracas|HUC/i,        lat: 10.4891, lng: -66.9016 },
  { pat: /hospital.*vargas/i,                            lat: 10.4879, lng: -66.9052 },
  { pat: /pérez\s*carreño|perez\s*carreno/i,             lat: 10.5058, lng: -66.8987 },
  { pat: /hospital.*j\.?m\.?\s*(de\s*los)?\s*ríos|jmr/i, lat: 10.4944, lng: -66.9002 },
  { pat: /clínico\s*universitario|clinico.*univ/i,       lat: 10.4937, lng: -66.8913 },
  { pat: /hospital.*coche/i,                             lat: 10.4684, lng: -66.9296 },
  { pat: /hospital.*josé\s*gregorio|jose\s*gregorio/i,   lat: 10.5078, lng: -66.9234 },
  { pat: /hospital.*lídice|lidice/i,                     lat: 10.5006, lng: -66.9155 },
  { pat: /hospital.*magallanes/i,                        lat: 10.4833, lng: -66.8994 },
  { pat: /hospital.*militar/i,                           lat: 10.4925, lng: -66.8908 },
  { pat: /hospital.*razetti/i,                           lat: 10.4870, lng: -66.9080 },
  { pat: /hospital.*maternidad/i,                        lat: 10.4908, lng: -66.9050 },
  // Miranda
  { pat: /hospital.*miranda|guarenas|guatire/i,          lat: 10.4667, lng: -66.5333 },
  { pat: /hospital.*petare/i,                            lat: 10.4833, lng: -66.8167 },
  { pat: /hospital.*los\s*teques/i,                      lat: 10.3462, lng: -67.0407 },
  { pat: /hospital.*charallave/i,                        lat: 10.2484, lng: -66.8583 },
  // Aragua
  { pat: /hospital.*maracay|central.*maracay/i,          lat: 10.2469, lng: -67.5958 },
  { pat: /hospital.*victoria/i,                          lat: 10.2297, lng: -67.3327 },
  // Carabobo
  { pat: /hospital.*valencia|central.*valencia/i,        lat: 10.1621, lng: -68.0075 },
  { pat: /hospital.*balbino\s*garcia/i,                  lat: 10.1750, lng: -68.0037 },
];

function resolveHospitalCoords(centerName) {
  if (!centerName) return { lat: null, lng: null };
  for (const { pat, lat, lng } of HOSPITAL_COORDS) {
    if (pat.test(centerName)) return { lat, lng };
  }
  return { lat: null, lng: null };
}

// ── Normalización de estado del paciente ─────────────────────────────────
function normalizeStatus(raw) {
  if (!raw) return 'stable';
  const s = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/falleci|obito|muert/.test(s)) return 'deceased';
  if (/critic|muy\s*grav/.test(s))  return 'critical';
  if (/grav/.test(s))               return 'serious';
  if (/leve|estable|stable/.test(s)) return 'stable';
  return 'stable';
}

function normalizeSex(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.startsWith('f') || s.includes('femen')) return 'female';
  if (s.startsWith('m') || s.includes('mascul')) return 'male';
  return null;
}

// ── Mapear registro LP → esquema patients ─────────────────────────────────
function mapRecord(r) {
  const name = [r.nombre, r.apellido, r.name, r.full_name, r.paciente, r.nombreCompleto, r.nombre_completo]
    .filter(Boolean)
    .join(' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!name || name.length < 2) return null;

  const centerName = (
    r.hospital || r.centro || r.centro_salud || r.establecimiento ||
    r.center || r.facility || r.hospitalNombre || r.hospital_nombre || ''
  ).trim();

  const { lat, lng } = resolveHospitalCoords(centerName);

  const sourceId = String(
    r.id || r._id || r.pk || r.codigo || r.code || r.identificador || ''
  ).trim();
  if (!sourceId) return null;

  return {
    name,
    age:           parseInt(r.edad || r.age) || null,
    sex:           normalizeSex(r.sexo || r.genero || r.sex || r.gender),
    id_number:     r.cedula || r.ci || r.id_number || r.documento || r.identidad || null,
    center_name:   centerName || 'Sin información',
    center_address: r.direccion || r.address || r.ubicacion || null,
    center_lat:    r.lat ?? r.latitude ?? lat,
    center_lng:    r.lng ?? r.longitude ?? lng,
    status:        normalizeStatus(r.estado || r.condicion || r.status || r.condition),
    notes:         r.notas || r.observaciones || r.notes || null,
    state:         r.estado_territorio || r.entidad || r.estado_vzla || r.estadoVzla || null,
    source_url:    SOURCE_URL,
    source_label:  SOURCE_LABEL,
    source_id:     sourceId,
  };
}

// ── IDs ya importados ─────────────────────────────────────────────────────
async function getExistingSourceIds() {
  const ids = new Set();
  let page = 0;
  while (true) {
    const { data, error } = await supabaseAnon
      .from('patients')
      .select('source_id')
      .eq('source_url', SOURCE_URL)
      .not('source_id', 'is', null)
      .range(page * 1000, page * 1000 + 999);
    if (error || !data || data.length === 0) break;
    data.forEach(r => ids.add(r.source_id));
    if (data.length < 1000) break;
    page++;
  }
  return ids;
}

// ── Upsert batch → patients ───────────────────────────────────────────────
async function upsertBatch(rows) {
  const { data, error } = await supabaseSvc
    .from('patients')
    .upsert(rows, { onConflict: 'source_url,source_id', ignoreDuplicates: false })
    .select('id,name');

  if (error) {
    // Fallback: insertar uno a uno
    const inserted = [];
    for (const row of rows) {
      const { data: d, error: e2 } = await supabaseSvc
        .from('patients')
        .upsert(row, { onConflict: 'source_url,source_id', ignoreDuplicates: false })
        .select('id,name')
        .single();
      if (!e2 && d) inserted.push(d);
    }
    return inserted;
  }
  return data || [];
}

// ── Auto-match paciente contra desaparecidos ──────────────────────────────
async function autoMatchPatient(patientId, patientName) {
  const { data, error } = await supabaseSvc
    .rpc('suggest_missing_matches', { p_patient_id: patientId });

  if (error || !data || data.length === 0) return null;

  const top = data[0];
  if (top.score < AUTO_MATCH_THRESHOLD) return null;
  if (top.status === 'encontrado') return null;

  const { data: linked, error: e2 } = await supabaseSvc
    .rpc('auto_link_missing_to_patient', {
      p_missing_id: top.missing_id,
      p_patient_id: patientId,
      p_score:      top.score,
    });

  if (e2) {
    console.warn(`    ⚠ auto_link error para ${patientName}: ${e2.message}`);
    return null;
  }

  return linked ? { missingId: top.missing_id, missingName: top.missing_name, score: top.score } : null;
}

// ── Extraer pacientes de respuesta JSON ───────────────────────────────────
function extractPatientsFromJson(json) {
  if (Array.isArray(json)) return json;
  for (const key of ['data', 'pacientes', 'patients', 'results', 'items', 'records', 'personas']) {
    if (Array.isArray(json[key]) && json[key].length > 0) return json[key];
  }
  return [];
}

function extractTotal(json) {
  return json.total || json.count || json.totalCount || json.total_count ||
    json.meta?.total || json.pagination?.total || null;
}

// ── Scraping principal via Playwright ─────────────────────────────────────
async function scrapeLocalizaPacientes(browser) {
  console.log('📡 Abriendo localizapacientes.com con Playwright...');

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'es-VE',
    timezoneId: 'America/Caracas',
    extraHTTPHeaders: {
      'Accept-Language': 'es-VE,es;q=0.9,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    }
  });

  const allPatients = [];
  let discoveredApiBase = null;
  let discoveredApiParams = '';
  let totalRemote = null;

  // Interceptar respuestas JSON que parezcan listas de pacientes
  ctx.on('response', async res => {
    try {
      const url = res.url();
      const status = res.status();
      if (status !== 200) return;
      const ctype = res.headers()['content-type'] || '';
      if (!ctype.includes('json') && !ctype.includes('javascript')) return;

      const json = await res.json().catch(() => null);
      if (!json) return;

      const arr = extractPatientsFromJson(json);
      if (arr.length === 0) return;

      // Verificar que parezcan pacientes
      const first = arr[0];
      const hasPatientFields = first.nombre || first.name || first.paciente ||
        first.nombreCompleto || first.full_name || first.apellido;
      if (!hasPatientFields) return;

      console.log(`  ✓ API JSON detectada: ${url.replace(/\?.*/, '')} (${arr.length} registros)`);

      if (!discoveredApiBase) {
        const parsed = new URL(url);
        discoveredApiBase = `${parsed.origin}${parsed.pathname}`;
        // Limpiar params de paginación para reutilizar
        const params = new URLSearchParams(parsed.search);
        ['page', 'limit', 'offset', 'size', 'per_page', 'pageSize', 'p'].forEach(k => params.delete(k));
        discoveredApiParams = params.toString();
        totalRemote = extractTotal(json);
      }

      allPatients.push(...arr);
    } catch { /* noop */ }
  });

  const page = await ctx.newPage();

  // Cargar página principal
  console.log('  → Cargando página principal...');
  try {
    await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 35000 });
  } catch {
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);
  }

  const title = await page.title().catch(() => '');
  console.log(`  → Título: "${title}"`);

  // Intentar interactuar con el campo de búsqueda para disparar la API
  const inputSelectors = [
    'input[type="search"]',
    'input[placeholder*="nombre" i]',
    'input[placeholder*="buscar" i]',
    'input[placeholder*="cédula" i]',
    'input[placeholder*="cedula" i]',
    'input[name*="buscar"]',
    'input[name*="search"]',
    'input[name*="nombre"]',
    'input[name*="query"]',
    'input[id*="search" i]',
    'input[id*="buscar" i]',
    '.search-input input',
    '#buscador input',
    'form input[type="text"]',
    'input[type="text"]',
  ];

  let searchEl = null;
  for (const sel of inputSelectors) {
    try {
      const el = await page.$(sel);
      if (el && await el.isVisible()) { searchEl = el; break; }
    } catch { /* noop */ }
  }

  if (searchEl) {
    console.log('  → Campo de búsqueda encontrado, disparando búsquedas...');
    // Búsqueda vacía primero (algunos sitios muestran todos)
    await searchEl.click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Luego con letra común
    if (!discoveredApiBase) {
      await searchEl.fill('a');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      // Botón de búsqueda
      const submitSels = [
        'button[type="submit"]',
        'button:has-text("Buscar")',
        'button:has-text("buscar")',
        '.btn-search',
        '[data-action="search"]',
      ];
      for (const sel of submitSels) {
        try {
          const btn = await page.$(sel);
          if (btn && await btn.isVisible()) {
            await btn.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch { /* noop */ }
      }
    }
  } else {
    console.log('  → Sin campo de búsqueda visible — analizando carga inicial');
    await page.waitForTimeout(3000);
  }

  // Si aún no hay API, intentar scraping DOM
  if (allPatients.length === 0) {
    console.log('  → Intentando extracción DOM...');
    const domPatients = await page.evaluate(() => {
      const results = [];
      // Buscar tablas
      document.querySelectorAll('table tbody tr').forEach(row => {
        const cells = [...row.querySelectorAll('td')].map(c => c.textContent.trim()).filter(Boolean);
        if (cells.length >= 2 && cells[0].length > 1) {
          results.push({ nombre: cells[0], hospital: cells[1] || '', estado: cells[2] || '', raw: cells });
        }
      });
      // Buscar cards
      document.querySelectorAll('.patient, .paciente, [class*="patient"], [class*="result"], [class*="card"]').forEach(card => {
        const texts = [...card.querySelectorAll('*')].map(el => el.textContent.trim()).filter(t => t.length > 1 && t.length < 200);
        if (texts.length >= 2) {
          results.push({ nombre: texts[0], hospital: texts[1] || '', raw: texts });
        }
      });
      return results;
    });
    console.log(`  → ${domPatients.length} registros DOM encontrados`);
    allPatients.push(...domPatients);
  }

  await ctx.close();

  return {
    patients: allPatients,
    apiBase: discoveredApiBase,
    apiParams: discoveredApiParams,
    total: totalRemote,
  };
}

// ── Paginar API descubierta ────────────────────────────────────────────────
async function paginateDiscoveredApi(browser, apiBase, apiParams, existingCount) {
  const PAGE_SIZE = 100;
  const allPatients = [];
  let page = 2; // la página 1 ya se capturó en la intercepción
  let offset = existingCount;

  console.log(`\n📄 Paginando ${apiBase}...`);

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'es-VE',
  });
  const pg = await ctx.newPage();

  // Cargar el sitio para tener cookies/sesión activa
  await pg.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

  while (true) {
    const sep = apiParams ? '&' : '?';
    const baseQ = apiParams ? `${apiBase}?${apiParams}` : apiBase;
    const pageUrl = `${baseQ}${sep}page=${page}&limit=${PAGE_SIZE}&offset=${offset}&size=${PAGE_SIZE}&per_page=${PAGE_SIZE}`;

    try {
      const json = await pg.evaluate(async (url) => {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return null;
        return res.json();
      }, pageUrl);

      if (!json) { console.log(`\n  → Página ${page}: respuesta vacía, fin`); break; }

      const arr = extractPatientsFromJson(json);
      if (arr.length === 0) { console.log(`\n  → Página ${page}: 0 registros, fin`); break; }

      allPatients.push(...arr);
      process.stdout.write(`\r  → Página ${page}: +${arr.length} = ${existingCount + allPatients.length} total`);

      if (arr.length < PAGE_SIZE) break; // última página

      page++;
      offset += PAGE_SIZE;
      await pg.waitForTimeout(350);
    } catch (err) {
      console.warn(`\n  ⚠ Error en página ${page}: ${err.message}`);
      break;
    }
  }

  console.log('');
  await ctx.close();
  return allPatients;
}

// ── Deduplicación: reportar duplicados en patients ─────────────────────────
async function reportDuplicates() {
  const { data, error } = await supabaseSvc
    .from('patients_duplicates')
    .select('*')
    .limit(50);

  if (error) {
    // Vista puede no existir si la migración no se aplicó aún
    if (error.code !== '42P01') {
      console.warn('  ⚠ Vista duplicados:', error.message);
    }
    return;
  }
  if (!data || data.length === 0) {
    console.log('  ✓ Sin duplicados detectados en patients');
    return;
  }
  console.log(`\n⚠ ${data.length} posibles duplicados en patients:`);
  for (const d of data.slice(0, 15)) {
    const score = d.name_score != null ? ` (sim: ${d.name_score.toFixed(2)})` : '';
    console.log(`   [${d.match_type}] "${d.name_a}" ↔ "${d.name_b}" @ ${d.center_name}${score} [${d.source_a ?? 'manual'} / ${d.source_b ?? 'manual'}]`);
  }
  if (data.length > 15) console.log(`   ... y ${data.length - 15} más`);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log(`\n=== Sync localizapacientes.com → Supabase [${new Date().toISOString()}] ===\n`);

  const browser = await chromium.launch({ headless: true });

  // Fase 1: descubrir API y capturar primera tanda
  const { patients: firstBatch, apiBase, apiParams, total } = await scrapeLocalizaPacientes(browser);

  console.log(`\n  → Primera tanda: ${firstBatch.length} registros${total ? ` / ${total} total` : ''}`);

  // Fase 2: paginar el resto si hay API descubierta
  let allRaw = [...firstBatch];
  if (apiBase && (total === null || total > firstBatch.length)) {
    const morePacientes = await paginateDiscoveredApi(browser, apiBase, apiParams, firstBatch.length);
    allRaw.push(...morePacientes);
  }

  await browser.close();

  if (allRaw.length === 0) {
    console.log('\n⚠ No se obtuvieron pacientes.');
    console.log('  Posibles causas: el sitio cambió su estructura, requiere auth adicional, o está caído.');
    console.log('  Consejo: revisar manualmente https://localizapacientes.com');
    process.exit(0);
  }

  console.log(`\n📋 ${allRaw.length} registros brutos obtenidos`);

  // IDs ya en nuestra DB
  const existing = await getExistingSourceIds();
  console.log(`📦 Ya en nuestra DB con esta fuente: ${existing.size}`);

  // Mapear y filtrar
  const toInsert = [];
  let skipped = 0, invalid = 0;
  const seenIds = new Set([...existing]);

  for (const r of allRaw) {
    const mapped = mapRecord(r);
    if (!mapped || !mapped.source_id) { invalid++; continue; }
    if (seenIds.has(mapped.source_id)) { skipped++; continue; }
    seenIds.add(mapped.source_id);
    toInsert.push(mapped);
  }

  console.log(`→ ${toInsert.length} nuevos | ${skipped} ya existían | ${invalid} inválidos`);

  if (toInsert.length === 0) {
    console.log('\n✅ Base de datos ya actualizada.');
    await reportDuplicates();
    return;
  }

  // Insertar en batches
  let insertedRows = [];
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const batchN = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toInsert.length / BATCH_SIZE);
    process.stdout.write(`  → Batch ${batchN}/${totalBatches}... `);
    const inserted = await upsertBatch(batch);
    insertedRows.push(...inserted);
    console.log(`✓ ${inserted.length}`);
    if (i + BATCH_SIZE < toInsert.length) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✓ ${insertedRows.length} pacientes insertados/actualizados`);

  // Auto-matching contra missing_persons
  if (insertedRows.length > 0) {
    console.log(`\n🔗 Auto-matching contra desaparecidos (umbral ${AUTO_MATCH_THRESHOLD})...`);
    let matchCount = 0;
    const matchLog = [];

    for (const patient of insertedRows) {
      const match = await autoMatchPatient(patient.id, patient.name);
      if (match) {
        matchCount++;
        matchLog.push(`   ✅ "${patient.name}" ↔ "${match.missingName}" (score: ${match.score.toFixed(2)})`);
      }
      await new Promise(r => setTimeout(r, 80));
    }

    if (matchCount > 0) {
      console.log(`\n🎯 ${matchCount} matches automáticos:`);
      matchLog.slice(0, 20).forEach(l => console.log(l));
      if (matchLog.length > 20) console.log(`   ... y ${matchLog.length - 20} más`);
    } else {
      console.log('  → Sin matches automáticos nuevos');
    }
  }

  // Verificación de duplicados
  console.log('\n🔍 Verificando duplicados en tabla patients...');
  await reportDuplicates();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Completado en ${elapsed}s`);
  console.log(`   ${insertedRows.length} pacientes insertados | vinculados a desaparecidos vía auto-match`);
}

main().catch(e => {
  console.error('\n💥 Error fatal:', e.message);
  process.exit(1);
});
