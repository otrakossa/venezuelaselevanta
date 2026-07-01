/**
 * sync-localizapacientes.mjs
 * Importa localizapacientes.com → Supabase patients
 *
 * La API pública del sitio expone:
 *   GET /api/hospitals   → lista de hospitales con pacientesRegistrados
 *   GET /api/search?q=XX → búsqueda substring (mín 2 chars, máx 50 resultados)
 *
 * Estrategia de enumeración: búsquedas por todos los bigramas de letras (aa–zz)
 * + pares de dígitos (00–99) para cubrir nombres y cédulas.
 * Deduplicación por ID nativo del sitio.
 *
 * Tras la importación, corre auto-matching fuzzy contra missing_persons.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// ── Cargar .env del proyecto ──────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = readFileSync(resolve('/var/www/venezuelaselevanta/.env'), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* usar variables del entorno del shell */ }
}
loadEnv();

// ── Configuración ─────────────────────────────────────────────────────────
const OUR_URL  = process.env.SUPABASE_URL || 'https://advebubtfjgxwpjxprok.supabase.co';
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY || !SVC_KEY) {
  console.error('❌ Faltan SUPABASE_PUBLISHABLE_KEY o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const SITE_API = 'https://localizapacientes.com/api';
const SOURCE_URL   = 'localizapacientes.com';
const SOURCE_LABEL = 'localizapacientes.com';
const BATCH_SIZE   = 100;
const AUTO_MATCH_THRESHOLD = 0.78;
const DELAY_MS     = 250;  // entre queries — respetuosos con el servidor

const supabaseAnon = createClient(OUR_URL, ANON_KEY, { realtime: { transport: ws } });
const supabaseSvc  = createClient(OUR_URL, SVC_KEY,  { realtime: { transport: ws } });

// ── Reporte de corridas a observabilidad (tabla scraper_runs) ─────────────
async function startRun() {
  try {
    const { data, error } = await supabaseSvc
      .from('scraper_runs')
      .insert({ source_label: SOURCE_LABEL, status: 'running' })
      .select('id')
      .single();
    if (error) { console.warn('⚠ scraper_runs start:', error.message); return null; }
    return data?.id ?? null;
  } catch (e) { console.warn('⚠ scraper_runs start:', e.message); return null; }
}
async function finishRun(runId, status, patch) {
  if (!runId) return;
  try {
    await supabaseSvc.from('scraper_runs').update({
      status,
      finished_at: new Date().toISOString(),
      ...patch,
    }).eq('id', runId);
  } catch (e) { console.warn('⚠ scraper_runs finish:', e.message); }
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://localizapacientes.com/',
  'Accept-Language': 'es-VE,es;q=0.9',
};

// ── Coordenadas de hospitales venezolanos ─────────────────────────────────
const HOSPITAL_COORDS = [
  { pat: /pérez\s*carreño|perez\s*carreno/i,             lat: 10.5058, lng: -66.8987 },
  { pat: /vargas/i,                                      lat: 10.4879, lng: -66.9052 },
  { pat: /universitario.*caracas|HUC/i,                  lat: 10.4891, lng: -66.9016 },
  { pat: /j\.?m\.?\s*(de\s*los)?\s*ríos|jmr|los\s*ríos/i, lat: 10.4944, lng: -66.9002 },
  { pat: /clínico\s*universitario|clinico.*univ/i,       lat: 10.4937, lng: -66.8913 },
  { pat: /coche/i,                                       lat: 10.4684, lng: -66.9296 },
  { pat: /josé\s*gregorio|jose\s*gregorio/i,             lat: 10.5078, lng: -66.9234 },
  { pat: /lídice|lidice/i,                               lat: 10.5006, lng: -66.9155 },
  { pat: /magallanes/i,                                  lat: 10.4833, lng: -66.8994 },
  { pat: /militar/i,                                     lat: 10.4925, lng: -66.8908 },
  { pat: /razetti/i,                                     lat: 10.4870, lng: -66.9080 },
  { pat: /maternidad|materno/i,                          lat: 10.4908, lng: -66.9050 },
  { pat: /pérez\s*de\s*león|perez.*leon/i,               lat: 10.4833, lng: -66.8167 },
  { pat: /luciani/i,                                     lat: 10.4820, lng: -66.8790 },
  { pat: /catia(?!\s*la)/i,                              lat: 10.5006, lng: -66.9400 },
  { pat: /guaira|guira/i,                                lat: 10.6005, lng: -66.9332 },
  { pat: /caribia/i,                                     lat: 10.5600, lng: -67.1000 },
  { pat: /misiones|hugo\s*ch/i,                          lat: 10.4806, lng: -66.9036 },
  { pat: /miranda|guarenas|guatire/i,                    lat: 10.4667, lng: -66.5333 },
  { pat: /petare/i,                                      lat: 10.4833, lng: -66.8167 },
  { pat: /los\s*teques/i,                                lat: 10.3462, lng: -67.0407 },
  { pat: /charallave/i,                                  lat: 10.2484, lng: -66.8583 },
  { pat: /maracay|central.*maracay/i,                    lat: 10.2469, lng: -67.5958 },
  { pat: /valencia|balbino/i,                            lat: 10.1621, lng: -68.0075 },
  { pat: /CDI|ambulatorio/i,                             lat: 10.4806, lng: -66.9036 },
];

function resolveCoords(hospital, ciudad, estado) {
  const text = `${hospital} ${ciudad} ${estado}`;
  for (const { pat, lat, lng } of HOSPITAL_COORDS) {
    if (pat.test(text)) return { lat, lng };
  }
  return { lat: null, lng: null };
}

// ── Normalización ─────────────────────────────────────────────────────────
function normalizeStatus(condicion) {
  if (!condicion) return 'stable';
  const s = condicion.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/falleci|obito|muert|deceas/.test(s)) return 'deceased';
  if (/critic|muy\s*grav/.test(s))         return 'critical';
  if (/grav/.test(s))                      return 'serious';
  return 'stable';
}

// nombreCompleto puede contener la cédula: "Juan Perez 12.345.678"
// Separar nombre de cédula
function parseName(nombreCompleto) {
  if (!nombreCompleto) return { name: '', cedula: null };
  // Cédula venezolana: V- o E- opcional, dígitos con puntos
  const cedulaMatch = nombreCompleto.match(/\b([VEJPGvejpg]-?\s?\d[\d.]{5,12})\s*$/);
  if (cedulaMatch) {
    const cedula = cedulaMatch[1].replace(/\s+/g, '').toUpperCase();
    const name   = nombreCompleto.slice(0, cedulaMatch.index).trim();
    return { name, cedula };
  }
  // Sin cédula explícita
  return { name: nombreCompleto.trim(), cedula: null };
}

// ── Mapear registro LP → esquema patients ─────────────────────────────────
function mapRecord(r) {
  const { name, cedula } = parseName(r.nombreCompleto);
  if (!name || name.length < 2) return null;

  const { lat, lng } = resolveCoords(r.hospital || '', r.ciudad || '', r.estado || '');

  return {
    name,
    age:           parseInt(r.edad) || null,
    sex:           null,
    id_number:     cedula,
    center_name:   r.hospital || 'Sin información',
    center_address: r.direccion || null,
    center_lat:    r.lat ?? lat,
    center_lng:    r.lng ?? lng,
    status:        normalizeStatus(r.condicion),
    notes:         r.condicion ? `Condición: ${r.condicion}` : null,
    state:         r.estado || null,
    source_url:    SOURCE_URL,
    source_label:  SOURCE_LABEL,
    source_id:     String(r.id),
  };
}

// ── Llamar /api/search?q=XX ───────────────────────────────────────────────
async function searchQuery(q) {
  const url = `${SITE_API}/search?q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const json = await res.json();
    return json.resultados || [];
  } catch {
    return [];
  }
}

// ── Obtener lista de hospitales ───────────────────────────────────────────
async function fetchHospitals() {
  try {
    const res = await fetch(`${SITE_API}/hospitals`, { headers: HEADERS });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

// ── IDs ya importados en nuestra DB ──────────────────────────────────────
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

// ── Upsert batch ──────────────────────────────────────────────────────────
async function upsertBatch(rows) {
  const { data, error } = await supabaseSvc
    .from('patients')
    .upsert(rows, { onConflict: 'source_url,source_id', ignoreDuplicates: false })
    .select('id,name');

  if (error) {
    const inserted = [];
    for (const row of rows) {
      const { data: d } = await supabaseSvc
        .from('patients')
        .upsert(row, { onConflict: 'source_url,source_id', ignoreDuplicates: false })
        .select('id,name')
        .single();
      if (d) inserted.push(d);
    }
    return inserted;
  }
  return data || [];
}

// ── Auto-match paciente → desaparecido ────────────────────────────────────
async function autoMatchPatient(patientId, patientName) {
  const { data, error } = await supabaseSvc
    .rpc('suggest_missing_matches', { p_patient_id: patientId });
  if (error || !data || data.length === 0) return null;

  const top = data[0];
  if (top.score < AUTO_MATCH_THRESHOLD || top.status === 'encontrado') return null;

  const { data: linked } = await supabaseSvc
    .rpc('auto_link_missing_to_patient', {
      p_missing_id: top.missing_id,
      p_patient_id: patientId,
      p_score:      top.score,
    });

  return linked ? { missingName: top.missing_name, score: top.score } : null;
}

// ── Detectar duplicados ────────────────────────────────────────────────────
async function reportDuplicates() {
  const { data, error } = await supabaseSvc
    .from('patients_duplicates')
    .select('*')
    .limit(50);

  if (error) return; // vista puede no existir aún (migración pendiente)
  if (!data || data.length === 0) {
    console.log('  ✓ Sin duplicados detectados');
    return;
  }
  console.log(`\n⚠ ${data.length} posibles duplicados:`);
  data.slice(0, 15).forEach(d => {
    const score = d.name_score != null ? ` (sim:${d.name_score.toFixed(2)})` : '';
    console.log(`  [${d.match_type}] "${d.name_a}" ↔ "${d.name_b}" @ ${d.center_name}${score}`);
  });
  if (data.length > 15) console.log(`  ... y ${data.length - 15} más`);
}

// ── Generar queries de cobertura total ────────────────────────────────────
function buildQueryList() {
  const queries = [];
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';

  // Todos los bigramas de letras (aa–zz): 676 queries
  for (const a of letters) {
    for (const b of letters) {
      queries.push(a + b);
    }
  }

  // Todos los pares dígito-dígito (00–99): 100 queries
  // Para capturar cédulas con formato "12.345.678"
  for (const a of digits) {
    for (const b of digits) {
      queries.push(a + b);
    }
  }

  // Dígito-punto y punto-dígito para cédulas venezolanas "15.8xx"
  for (const d of digits) {
    queries.push(d + '.');
  }

  return queries;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  const runId = await startRun();
  console.log(`\n=== Sync localizapacientes.com → Supabase [${new Date().toISOString()}] (run ${runId ?? 'n/a'}) ===\n`);

  // Obtener estadísticas del sitio
  const hospitals = await fetchHospitals();
  const totalSite = hospitals.reduce((s, h) => s + (h.pacientesRegistrados || 0), 0);
  console.log(`📋 Sitio reporta: ${totalSite} pacientes en ${hospitals.length} hospitales`);
  hospitals.forEach(h => console.log(`   - ${h.nombre}: ${h.pacientesRegistrados} px (${h.estadoReporte})`));

  // IDs ya importados
  const existingIds = await getExistingSourceIds();
  console.log(`\n📦 Ya en nuestra DB con esta fuente: ${existingIds.size}`);

  // Construir lista de queries para cobertura total
  const queries = buildQueryList();
  console.log(`\n🔍 Ejecutando ${queries.length} queries de cobertura...`);

  const allPatients = new Map(); // id → record
  let queriesRun = 0;
  let queriesWithResults = 0;

  for (const q of queries) {
    const results = await searchQuery(q);
    queriesRun++;

    for (const r of results) {
      if (!allPatients.has(r.id)) {
        allPatients.set(r.id, r);
      }
    }
    if (results.length > 0) queriesWithResults++;

    // Progreso cada 50 queries
    if (queriesRun % 50 === 0) {
      process.stdout.write(`\r  → ${queriesRun}/${queries.length} queries | ${allPatients.size} únicos encontrados`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\r  → ${queriesRun} queries completadas | ${allPatients.size} pacientes únicos`);
  console.log(`  → Queries con resultados: ${queriesWithResults}/${queriesRun}`);

  if (allPatients.size === 0) {
    console.log('\n⚠ No se encontraron pacientes.');
    process.exit(0);
  }

  // Filtrar ya existentes y mapear
  const toInsert = [];
  let skipped = 0, invalid = 0;

  for (const [id, r] of allPatients) {
    if (existingIds.has(String(id))) { skipped++; continue; }
    const mapped = mapRecord(r);
    if (!mapped) { invalid++; continue; }
    toInsert.push(mapped);
  }

  console.log(`\n→ ${toInsert.length} nuevos | ${skipped} ya existían | ${invalid} inválidos`);

  if (toInsert.length === 0) {
    console.log('\n✅ Base de datos ya actualizada.');
    await reportDuplicates();
    return;
  }

  // Insertar en batches
  let insertedRows = [];
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const bN = Math.floor(i / BATCH_SIZE) + 1;
    const tN = Math.ceil(toInsert.length / BATCH_SIZE);
    process.stdout.write(`  → Batch ${bN}/${tN}... `);
    const ins = await upsertBatch(batch);
    insertedRows.push(...ins);
    console.log(`✓ ${ins.length}`);
    if (i + BATCH_SIZE < toInsert.length) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✓ ${insertedRows.length} pacientes insertados`);

  // Auto-matching
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
      console.log('  → Sin matches nuevos');
    }
  }

  // Duplicados
  console.log('\n🔍 Verificando duplicados...');
  await reportDuplicates();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Completado en ${elapsed}s`);
  console.log(`   Cobertura: ${allPatients.size}/${totalSite} únicos capturados (${Math.round(allPatients.size/totalSite*100)}%)`);
  console.log(`   ${insertedRows.length} insertados | auto-matched con desaparecidos`);
}

main().catch(e => {
  console.error('\n💥 Error fatal:', e.message);
  process.exit(1);
});
