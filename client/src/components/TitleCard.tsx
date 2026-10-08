import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { typeLabel, type MediaType, type Title } from "@/lib/api";

export function TitleCard({ t }: { t: Title }) {
  return (
    <Link to="/obra/$id" params={{ id: String(t.id) }} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 group-hover:scale-[1.03] group-hover:border-primary/40 group-hover:shadow-glow">
        {t.cover_url ? (
          <img src={t.cover_url} alt={t.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-dust">{t.name}</div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-overlay px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md">
          {typeLabel[t.type]}
        </span>
        {(t.has_sub || t.has_dub) && (
          <div className="absolute bottom-2 left-2 flex gap-1 font-mono text-[10px] font-bold">
            {t.has_sub && <span className="rounded bg-sub px-1.5 py-0.5 text-secondary-foreground">SUB</span>}
            {t.has_dub && <span className="rounded bg-dub px-1.5 py-0.5 text-secondary-foreground">DUB</span>}
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-1 text-sm font-bold">{t.name}</h3>
        <p className="font-mono text-xs text-muted-foreground">
          {t.publication_year}{t.episode_count ? ` · ${t.episode_count} ${t.type === "anime" ? "eps" : t.type === "novel" ? "vols" : "caps"}` : ""}
        </p>
      </div>
    </Link>
  );
}

export function TypeFilter({ value, onChange, label = "Filtrar por tipo" }: { value: MediaType | undefined; onChange: (v: MediaType | undefined) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} className="scrollbar-none flex max-w-full gap-1 overflow-x-auto">
      {([{ label: "Todos", value: undefined }, { label: "Animes", value: "anime" }, { label: "Mangás", value: "manga" }, { label: "Novels", value: "novel" }] as const).map(({ label: l, value: v }) => (
        <Button key={l} size="sm" variant={value === v ? "secondary" : "ghost"} aria-pressed={value === v} onClick={() => onChange(v)} className={`shrink-0 ${value === v ? "" : "text-muted-foreground"}`}>{l}</Button>
      ))}
    </div>
  );
}

export function Rail({ title, children, action, filters }: { title: string; children: React.ReactNode; action?: React.ReactNode; filters?: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      setCanScrollLeft(element.scrollLeft > 2);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    Array.from(element.children).forEach((child) => observer.observe(child));
    element.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [children]);

  const move = (direction: number) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(element.clientWidth * 0.8, 180), behavior: "smooth" });
  };

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 md:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
          <h2 className="text-lg font-bold md:text-xl">{title}</h2>
          {filters}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          <div className="hidden items-center gap-1 md:flex">
            <Button variant="ghost" size="icon" aria-label={`Voltar em ${title}`} title="Voltar" disabled={!canScrollLeft} onClick={() => move(-1)}><ChevronLeft /></Button>
            <Button variant="ghost" size="icon" aria-label={`Avançar em ${title}`} title="Avançar" disabled={!canScrollRight} onClick={() => move(1)}><ChevronRight /></Button>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="scrollbar-none flex gap-4 overflow-x-auto px-4 pb-4 pt-1 md:px-8 [&>*]:w-36 [&>*]:shrink-0 md:[&>*]:w-44">
        {children}
      </div>
    </section>
  );
}

export function CardSkeleton() {
  return <div><div className="aspect-[2/3] animate-pulse rounded-xl bg-card" /><div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-card" /></div>;
}
