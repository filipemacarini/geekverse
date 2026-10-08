import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { TitleCard, CardSkeleton } from "@/components/TitleCard";
import { api, qs, type Genre, type Paginated, type Title } from "@/lib/api";

const search = z.object({
  q: z.string().optional(),
  type: z.enum(["anime", "manga", "novel"]).optional(),
  genre_id: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
});

export const Route = createFileRoute("/catalogo")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Catálogo — GeekVerse" },
      { name: "description", content: "Busque e filtre animes, mangás e novels por tipo e gênero." },
      { property: "og:title", content: "Catálogo — GeekVerse" },
      { property: "og:description", content: "Todo o catálogo de animes, mangás e novels do GeekVerse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Catalog,
});

const tabs = [
  { v: undefined, l: "Todos" }, { v: "anime", l: "Animes" }, { v: "manga", l: "Mangás" }, { v: "novel", l: "Novels" },
] as const;

function Catalog() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/catalogo" });
  const page = s.page ?? 1;
  const titles = useQuery({
    queryKey: ["titles", s],
    queryFn: () => api<Paginated<Title>>(`/titles${qs({ q: s.q, type: s.type, genre_id: s.genre_id, page, limit: 30 })}`),
  });
  const genres = useQuery({ queryKey: ["genres"], queryFn: () => api<Genre[]>("/genres") });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <div>
        <h1 className="text-3xl font-extrabold">{s.q ? <>Resultados para “<span className="text-primary">{s.q}</span>”</> : "Catálogo"}</h1>
        {titles.data && <p className="font-mono text-sm text-muted-foreground">{titles.data.total} obras</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.l} onClick={() => navigate({ search: { ...s, type: t.v, page: undefined } })}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${s.type === t.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
            {t.l}
          </button>
        ))}
      </div>
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        <GenreChip active={!s.genre_id} onClick={() => navigate({ search: { ...s, genre_id: undefined, page: undefined } })}>Todos os gêneros</GenreChip>
        {genres.data?.map((g) => (
          <GenreChip key={g.id} active={s.genre_id === g.id} onClick={() => navigate({ search: { ...s, genre_id: g.id, page: undefined } })}>{g.name}</GenreChip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {titles.isLoading ? Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />) : titles.data?.data.map((t) => <TitleCard key={t.id} t={t} />)}
      </div>
      {titles.data && titles.data.data.length === 0 && <p className="py-16 text-center text-muted-foreground">Nenhuma obra encontrada.</p>}
      {titles.isError && <p className="text-destructive">{(titles.error as Error).message}</p>}
      {titles.data && titles.data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ search: { ...s, page: page - 1 } })}>Anterior</Button>
          <span className="font-mono text-sm">{page} / {titles.data.total_pages}</span>
          <Button variant="outline" disabled={page >= titles.data.total_pages} onClick={() => navigate({ search: { ...s, page: page + 1 } })}>Próxima</Button>
        </div>
      )}
    </div>
  );
}

function GenreChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium ${active ? "bg-surface-hover text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}
