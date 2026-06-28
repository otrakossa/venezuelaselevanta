import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportClientError } from "../lib/error-reporting";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/components/Footer";
import { DeadQueueBanner } from "@/components/DeadQueueBanner";
import { LiveStatusBanner } from "@/components/LiveStatusBanner";
import { RouteProgress } from "@/components/RouteProgress";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">Página no encontrada</p>
        <a href="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Volver al mapa
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Algo falló</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Venezuela Se Levanta — Mapa colaborativo de crisis" },
      { name: "description", content: "Venezuela Se Levanta — plataforma ciudadana de respuesta colaborativa al terremoto. Reporta, consulta y ayuda en tiempo real. venezuelaselevanta.info" },
      { name: "theme-color", content: "#FF6B35" },
      { property: "og:site_name", content: "Venezuela Se Levanta" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Venezuela Se Levanta — Mapa colaborativo de crisis" },
      { property: "og:description", content: "Venezuela Se Levanta — plataforma ciudadana de respuesta colaborativa al terremoto. Reporta, consulta y ayuda en tiempo real. venezuelaselevanta.info" },
      { property: "og:image", content: "https://venezuelaselevanta.info/og-cover.jpg?v=3" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://venezuelaselevanta.info/og-cover.jpg?v=3" },
      { name: "twitter:title", content: "Venezuela Se Levanta — Mapa colaborativo de crisis" },
      { name: "twitter:description", content: "Venezuela Se Levanta — plataforma ciudadana de respuesta colaborativa al terremoto. Reporta, consulta y ayuda en tiempo real. venezuelaselevanta.info" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://venezuelaselevanta.info" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=3" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png?v=3" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=3" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    void import("@/lib/pwa-register");
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background flex flex-col">
        <RouteProgress />
        <Header />
        <LiveStatusBanner />
        <DeadQueueBanner />
        <OfflineBanner />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <BottomNav />
        <PWAInstallBanner />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
