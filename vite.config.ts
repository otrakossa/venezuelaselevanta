// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
  },
  vite: {
    // DEV ONLY: permite que el túnel (cloudflared) llegue al dev server.
    // No afecta producción (usa node-server/nitro). Revisar antes de mergear a main.
    server: { allowedHosts: [".trycloudflare.com"] },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        devOptions: { enabled: false },
        filename: "sw.js",
        workbox: {
          // SSR app — HTML must always come from the network. Never precache or
          // navigate-fallback to a stale shell pointing at hashed chunks of an
          // older build (that's what caused "el sitio no se renderiza completo"
          // after each deploy).
          navigateFallback: null,
          navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/],
          globPatterns: ["**/*.{js,css,ico,png,svg,jpg,webp,woff2}"],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/[a-c]?\.?tile\.openstreetmap\.org\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "osm-tiles",
                expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              },
            },
            {
              // Lectura offline del mapa: sirve la última copia cacheada de los
              // incidentes públicos cuando no hay red. Acotado a `reports`
              // (datos públicos del mapa) — NO cachear endpoints con PII
              // (patients, missing_persons, site_responsibles).
              urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/reports\b.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "reports-read",
                expiration: { maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: "Venezuela Se Levanta",
          short_name: "VSL Crisis",
          description: "Mapa colaborativo de crisis del terremoto de Venezuela",
          theme_color: "#0D2B45",
          background_color: "#0D2B45",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
          categories: ["utilities", "social"],
          lang: "es",
        },
      }),
    ],
  },
});
