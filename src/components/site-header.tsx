import { Link } from "@tanstack/react-router";
import { useState } from "react";
import rumboLogoUrl from "@/assets/rumbo-logo.png";

const worlds = [
  { title: "CARRERAS", to: "/carreras" },
  { title: "HISTORIAS", to: "/historias" },
  { title: "BITÁCORA", to: "/bitacora" },
  { title: "¿QUIÉN SOY?", to: "/quien-soy" },
] as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-outline-variant bg-topbar px-6 py-5 md:px-16">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between">
        <Link to="/" className="flex items-center" aria-label="rumbo">
          <img src={rumboLogoUrl} alt="rumbo" className="h-8 w-auto md:h-12" />
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-center lg:flex">
          <div className="pointer-events-auto flex items-center gap-8">
            {worlds.map((w) => (
              <Link
                key={w.to}
                to={w.to}
                activeProps={{
                  className:
                    "text-label-caps border-b-2 border-primary pb-1 text-primary",
                }}
                inactiveProps={{
                  className:
                    "text-label-caps text-topbar-muted transition hover:text-primary",
                }}
              >
                {w.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-label-caps hidden rounded-md border border-primary px-5 py-2 text-primary transition hover:bg-primary/10 lg:block"
          >
            ADMIN
          </button>

          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((s) => !s)}
            className="inline-flex flex-col justify-center gap-[6px] p-2 text-primary lg:hidden"
          >
            <span className="block h-0.5 w-6 bg-current" />
            <span className="block h-0.5 w-6 bg-current" />
            <span className="block h-0.5 w-6 bg-current" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute top-full left-0 w-full border-b border-outline-variant bg-topbar px-6 py-6 lg:hidden">
          <div className="flex flex-col gap-4">
            {worlds.map((w) => (
              <Link
                key={w.to}
                to={w.to}
                onClick={() => setMobileOpen(false)}
                activeProps={{
                  className:
                    "text-label-caps text-lg text-primary border-b-2 border-primary w-fit pb-1",
                }}
                inactiveProps={{
                  className:
                    "text-label-caps text-lg text-topbar-muted transition hover:text-primary",
                }}
              >
                {w.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
