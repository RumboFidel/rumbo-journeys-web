import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export function ComingSoon({ world, title }: { world: string; title: string }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <span className="text-label-caps mb-6 text-[10px] tracking-[0.4em] text-primary">
          {world}
        </span>
        <h1 className="font-display mb-6 text-4xl font-bold text-on-surface md:text-6xl">{title}</h1>
        <div className="mx-auto mb-8 h-px w-24 bg-outline-variant" />
        <p className="text-label-caps mb-12 text-primary/80">PRÓXIMAMENTE</p>
        <Link
          to="/"
          className="text-label-caps inline-flex items-center gap-2 border-2 border-primary/20 px-8 py-3 tracking-[0.25em] text-primary transition hover:bg-primary/5"
        >
          ← VOLVER AL INICIO
        </Link>
      </main>
    </div>
  );
}
