import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useEffect } from "react";

export function BackToBitacora() {
  return (
    <Link
      to="/bitacora"
      className="text-label-caps inline-flex items-center gap-2 border border-outline-variant px-4 py-2 text-[10px] tracking-[0.3em] text-on-surface transition hover:border-primary/60 hover:text-primary"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      VOLVER A BITÁCORA
    </Link>
  );
}

export function BitacoraSection({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SiteHeader />
      <main className="pt-24">
        <section className="mx-auto max-w-6xl px-6 py-12 md:px-16 md:py-16">
          <div className="mb-10 flex items-center justify-between gap-4">
            <BackToBitacora />
            <span className="text-label-caps text-[10px] tracking-[0.4em] text-primary">
              {eyebrow}
            </span>
          </div>
          <header className="mb-10 md:mb-14">
            <h1 className="font-display text-4xl font-extrabold text-on-surface md:text-5xl">
              {title}
            </h1>
            {intro && (
              <>
                <div className="mt-5 h-px w-16 bg-primary/70" aria-hidden />
                <p className="font-serif mt-5 max-w-2xl text-base leading-relaxed text-on-surface/60">
                  {intro}
                </p>
              </>
            )}
          </header>
          {children}
        </section>
      </main>
    </div>
  );
}

export function EmptyResults({ label = "Sin resultados con estos filtros." }: { label?: string }) {
  return (
    <div className="border border-dashed border-outline-variant p-10 text-center text-sm text-on-surface/60">
      {label}
    </div>
  );
}

export function FiltersBar({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <div className="mb-8 flex flex-col gap-3 border border-outline-variant bg-surface-container-lowest p-4 md:flex-row md:flex-wrap md:items-end md:gap-4">
      {children}
      <button
        type="button"
        onClick={onClear}
        className="text-label-caps ml-auto mt-2 border border-outline-variant px-4 py-2 text-[10px] tracking-[0.3em] text-on-surface transition hover:border-primary/60 hover:text-primary md:mt-0"
      >
        LIMPIAR FILTROS
      </button>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-label-caps text-[9px] tracking-[0.3em] text-on-surface/60">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "min-w-0 border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none";

const MESES_ES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

export function formatDate(iso?: string): string {
  if (!iso) return "";
  // Parse YYYY-MM-DD sin zona horaria para evitar hydration mismatch SSR/cliente.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const monthIdx = parseInt(mo, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return iso;
  return `${d} ${MESES_ES[monthIdx]} ${y}`;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
