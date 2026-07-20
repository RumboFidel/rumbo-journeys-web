import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BitacoraSection, EmptyResults, Field, FiltersBar, formatDate, inputCls } from "@/components/bitacora-shell";
import { repo } from "@/data/repository";
import type { MedalCategory } from "@/data/types";

export const Route = createFileRoute("/bitacora/medallas/")({
  head: () => ({
    meta: [
      { title: "Medallas — Bitácora · rumbo" },
      { name: "description", content: "Six World Majors, Andes y otras medallas registradas en la bitácora RUMBO." },
    ],
  }),
  component: MedallasIndex,
});

const CATS: (MedalCategory | "Todas")[] = ["Todas", "Six World Majors", "Andes", "Otras"];

function MedallasIndex() {
  const all = repo.medals.all();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("Todas");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const arr = all.filter((m) => {
      if (query && !`${m.raceName} ${m.city} ${m.country}`.toLowerCase().includes(query)) return false;
      if (cat !== "Todas" && m.category !== cat) return false;
      return true;
    });
    arr.sort((a, b) => order === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
    return arr;
  }, [all, q, cat, order]);

  const clear = () => { setQ(""); setCat("Todas"); setOrder("desc"); };

  return (
    <BitacoraSection eyebrow="BITÁCORA · 06" title="Medallas" intro="Registro de las carreras terminadas: Six World Majors, Andes y otras.">
      <FiltersBar onClear={clear}>
        <Field label="Buscar"><input className={inputCls} placeholder="Carrera, ciudad o país" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Categoría">
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value as any)}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Orden">
          <select className={inputCls} value={order} onChange={(e) => setOrder(e.target.value as "desc" | "asc")}>
            <option value="desc">Más recientes</option><option value="asc">Más antiguas</option>
          </select>
        </Field>
      </FiltersBar>

      {filtered.length === 0 ? <EmptyResults /> : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Link key={m.id} to="/bitacora/medallas/$slug" params={{ slug: m.slug }} className="group flex flex-col overflow-hidden border border-outline-variant bg-surface-container-lowest transition hover:border-primary/60">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={m.medalImage} alt={m.raceName} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <span className="text-label-caps absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 text-[9px] tracking-[0.3em] text-primary">{m.category.toUpperCase()}</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <span className="text-label-caps text-[10px] font-bold tracking-[0.3em] text-primary">{formatDate(m.date)}</span>
                <h2 className="font-display mt-1 text-lg font-extrabold leading-tight text-on-surface">{m.raceName}</h2>
                <p className="mt-1 text-xs text-on-surface/60">{m.city}, {m.country}</p>
                <p className="mt-1 text-xs text-on-surface/50">{m.distanceKm} km{m.officialTime ? ` · ${m.officialTime}` : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BitacoraSection>
  );
}
