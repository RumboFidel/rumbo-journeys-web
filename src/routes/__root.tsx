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
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-extrabold text-primary">404</h1>
        <h2 className="mt-4 font-display text-xl font-bold text-on-surface">Página no encontrada</h2>
        <p className="mt-2 text-sm text-on-surface/60">Este rumbo aún no existe.</p>
        <div className="mt-6">
          <a
            href="/"
            className="text-label-caps inline-flex items-center justify-center bg-primary px-6 py-3 text-on-primary transition hover:brightness-110"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-bold text-on-surface">Esta página no cargó</h1>
        <p className="mt-2 text-sm text-on-surface/60">Algo salió mal. Intenta de nuevo.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="text-label-caps inline-flex items-center justify-center bg-primary px-6 py-3 text-on-primary transition hover:brightness-110"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="text-label-caps inline-flex items-center justify-center border border-primary/40 px-6 py-3 text-primary transition hover:bg-primary/5"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "rumbo — 2.210 + 1 km alrededor de Ecuador" },
      {
        name: "description",
        content:
          "Un desafío para sentir un país y un corazón que laten con intensidad. Recorreré los 221 municipios de Ecuador, corriendo 10 km en cada uno.",
      },
      { property: "og:title", content: "rumbo — 2.210 + 1 km alrededor de Ecuador" },
      {
        property: "og:description",
        content: "Un desafío para sentir un país y un corazón que laten con intensidad. Recorreré los 221 municipios de Ecuador, corriendo 10 km en cada uno.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "rumbo — 2.210 + 1 km alrededor de Ecuador" },
      { name: "twitter:description", content: "Un desafío para sentir un país y un corazón que laten con intensidad. Recorreré los 221 municipios de Ecuador, corriendo 10 km en cada uno." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7290c768-e60a-437c-9543-b2f833f0af84/id-preview-e7ece6de--0d3863c9-064e-419c-84cc-092f2b7e1997.lovable.app-1784160161749.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7290c768-e60a-437c-9543-b2f833f0af84/id-preview-e7ece6de--0d3863c9-064e-419c-84cc-092f2b7e1997.lovable.app-1784160161749.png" },
    ],
    links: [
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/android-chrome-192x192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=JetBrains+Mono:wght@300;400&display=swap",
      },

      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-on-surface">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
