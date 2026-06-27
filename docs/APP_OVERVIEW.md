# Venezuela Se Levanta — Overview de la aplicación

Plataforma ciudadana de respuesta al terremoto. SSR (TanStack Start) + mapa Leaflet + Supabase.
Documento de contexto generado tras recorrer la app en local (`localhost:8080`).

## Shell (layout global)
- **Header:** logo, contador de reportes, toggle **Modo oscuro**, navegación.
- **Nav:** Mapa · Reportar · Desaparecidos · Atendidos · Necesidades · ¡Quiero ayudar! · Estadísticas · Donar · Créditos · Admin.
- **Footer:** **Datos abiertos** (GeoJSON, CSV-HXL), licencia CC BY 4.0, ecosistema (HDX, OpenStreetMap, Ushahidi, ReliefWeb/OCHA).

## Rutas (páginas)
| Ruta | Qué hace |
|---|---|
| `/` (Mapa) | Hero + mapa Leaflet de Venezuela: marcadores por categoría, clustering, filtros (categoría, Verificados, Confiables ≥70%, Sismos USGS, Desaparecidos), botón "Avisarme" (push), panel lateral "Reportes recientes" con compartir WhatsApp. |
| `/reportar` | Formulario sin cuenta: título, categoría, urgencia, descripción, dirección, **DIVIPOL en cascada** (Estado→Municipio→Parroquia), "Mi ubicación" (geoloc), foto/video, afectados, estado; mapa para fijar el punto. |
| `/reportes/:id` | Modal de detalle (URL `/?report=<id>`): categoría/urgencia/estado, compartir, **verificación ciudadana** (Confirmo/Dudo), información, ubicación, multimedia, **comentarios/actualizaciones** (máx 500). |
| `/desaparecidos` | Stats (Sin encontrar/Reunidos/Total), buscador, filtros por estado; por persona: Ver en mapa, **Buscar coincidencias en hospitales** (RPC `suggest_patient_matches`), Difundir, Copiar enlace, Marcar Encontrada. |
| `/pacientes` (Atendidos) | Registro de personas atendidas en centros de salud; stats (Total/En tratamiento/Alta/Hospitales activos); filtros; "Registrar atendido". Matching con desaparecidos. |
| `/necesidades` | Necesidades de la comunidad: KPIs por urgencia, filtros por categoría/urgencia/estado, tarjetas con "Ofrecer ayuda". |
| `/ofertas` (¡Quiero ayudar!) | Ofertas de ayuda: stats (Disponibles/Vinculadas/Entregadas), filtros, "Vincular" oferta↔necesidad. |
| `/estadisticas` | Dashboard "Centro de Control": KPIs, reportes/día (14d), por estado/categoría, Top zonas/estados/municipios (DIVIPOL), urgencia×categoría, **Sismos USGS** en vivo, export GeoJSON/CSV. |
| `/donar` | USDT TRC20 (activo, con wallet); Stripe/PayPal/Zelle/Pago Móvil "próximamente"; uso de fondos. |
| `/creditos` | Equipo (Codex), colaboradores, organizaciones aliadas, tecnología abierta, link al bot. |
| `/auth` | Login/registro (Supabase Auth) para "voluntarios verificados" (moderación). |
| `/admin` | Panel de moderación; **gated** por rol admin/moderator (`user_roles` + `has_role`). |

## API de datos abiertos
- `GET /api/reports.geojson` → `FeatureCollection` con metadata + licencia CC BY 4.0.
- `GET /api/reports.csv` → CSV con **etiquetas HXL** (`#geo+lat`, `#adm1+name`, …), compatible HDX/UNOCHA/QGIS/ArcGIS.

## Vocabularios de estado/categoría (fáciles de equivocar)
- `reports.urgency`: `critical | high | medium | low`
- `reports.status`: `active | attending | resolved`
- `missing_persons.status`: `missing | found | deceased`
- `needs.status`: `open | partial | fulfilled`  ⚠️ (NO `active`)
- `needs.category` / `offers.category` (enum de la UI): `medicine, food, water, volunteers, equipment, blood, money, other`
- `offers.status`: `available | matched | delivered`
- `categories` (slug de reportes): `missing, medical, rescue, shelter, infrastructure, evacuation, blocked_road, hospital, earthquake`

## Integraciones vivas
- **USGS:** el mapa y el dashboard muestran sismos reales (ingest USGS operativo).
- **Supabase:** lecturas anon + RPCs + storage; `service_role` para escrituras del servidor/bot.
- **Telegram:** bot por webhook (ver `src/routes/api/public/telegram/webhook.ts`).

## Notas de robustez
- `necesidades.tsx` y `ofertas.tsx` ahora usan accesores con **fallback** (`catMeta`/`urgMeta`): una categoría/urgencia fuera del enum (p.ej. de un ingest o el bot) ya **no tumba la página**, cae a `📦 Otro` / `Media`. Antes, un valor inesperado disparaba el error boundary (`Cannot read properties of undefined (reading 'emoji')`).
