import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Play, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Rail, TitleCard, CardSkeleton, TypeFilter } from "@/components/TitleCard";
import { api, typeLabel, type Art, type Favorite, type Genre, type MediaType, type Paginated, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GeekVerse — Animes, Mangás, Novels e Artes" },
      { name: "description", content: "Descubra adições recentes, artes em destaque da comunidade e trilhas por gênero no GeekVerse." },
      { property: "og:title", content: "GeekVerse — A vitrine geek" },
      { property: "og:description", content: "Animes, mangás, novels e fanarts em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [recentType, setRecentType] = useState<MediaType | undefined>();
  const recent = useQuery({ queryKey: ["titles", "recent"], queryFn: () => api<Paginated<Title>>("/titles?limit=20") });
  const filteredRecent = useQuery({
    queryKey: ["titles", "recent", recentType],
    queryFn: () => api<Paginated<Title>>(`/titles?type=${recentType}&limit=20`),
    enabled: Boolean(recentType),
  });
  const arts = useQuery({ queryKey: ["arts", "featured"], queryFn: () => api<Paginated<Art>>("/arts?limit=40") });
  const genres = useQuery({ queryKey: ["genres"], queryFn: () => api<Genre[]>("/genres") });

  const list = recent.data?.data ?? [];
  const shownRecent = recentType ? filteredRecent.data?.data ?? [] : list;
  const recentLoading = recentType ? filteredRecent.isLoading : recent.isLoading;
  const recentError = recentType ? filteredRecent.error : recent.error;
  const featured = list.find((t) => t.banner_url) ?? list[0];
  const topArts = [...(arts.data?.data ?? [])].sort((a, b) => b.likes_count - a.likes_count).slice(0, 12);

  return (
    <div className="pb-16">
      {featured ? <Hero t={featured} /> : <div className="h-[38vh]" />}
      <div className="relative z-10 space-y-10">
        <Rail title="Adições recentes" filters={<TypeFilter value={recentType} onChange={setRecentType} label="Filtrar adições recentes" />} action={<Link to="/catalogo" search={recentType ? { type: recentType } : {}} className="text-sm text-primary hover:underline">Ver tudo</Link>}>
          {recentLoading ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />) : shownRecent.map((t) => <TitleCard key={t.id} t={t} />)}
        </Rail>
        {recentError && <p className="px-8 text-sm text-destructive">Não foi possível carregar as adições: {(recentError as Error).message}</p>}

        <FavoritesRail />

        {topArts.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-end justify-between px-4 md:px-8">
              <h2 className="text-lg font-bold md:text-xl">Galeria em destaque</h2>
              <Link to="/galeria" className="text-sm text-secondary hover:underline">Abrir galeria</Link>
            </div>
            <div className="scrollbar-none flex gap-4 overflow-x-auto px-4 pb-2 md:px-8">
              {topArts.map((a) => (
                <Link key={a.id} to="/galeria" className="group relative h-56 w-44 shrink-0 overflow-hidden rounded-xl border border-border">
                  <img src={a.image_url} alt={a.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 flex flex-col justify-end bg-card-fade p-3">
                    <p className="line-clamp-1 text-sm font-semibold">{a.title}</p>
                    <p className="font-mono text-xs text-secondary">♥ {a.likes_count}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {["Aventura", "Comédia", "Slice of Life", "Romance"].map((name) => {
          const genre = genres.data?.find((g) => g.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
          return genre ? <GenreRail key={genre.id} genre={genre} /> : null;
        })}
      </div>
    </div>
  );
}

function Hero({ t }: { t: Title }) {
  return (
    <section className="relative min-h-[62vh] w-full overflow-hidden md:h-[62vh] md:min-h-[420px]">
      <img src={t.banner_url || t.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-hero-side" />
      <div className="absolute inset-0 bg-hero-fade" />
      <div className="relative mx-auto flex min-h-[62vh] max-w-7xl flex-col justify-center gap-4 px-4 py-16 md:h-full md:min-h-0 md:px-8 md:py-0">
        <span className="w-fit rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-primary">
          {typeLabel[t.type]} · {t.publication_year}
        </span>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-6xl">{t.name}</h1>
        <p className="line-clamp-3 max-w-xl text-muted-foreground">{t.synopsis}</p>
        <div className="flex gap-3">
          <Button asChild size="lg" className="shadow-glow">
            <Link to="/obra/$id" params={{ id: String(t.id) }}><Play className="mr-2 h-4 w-4 fill-current" />{t.type === "anime" ? "Assistir" : "Ler agora"}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="bg-card text-foreground hover:bg-surface-hover">
            <Link to="/obra/$id" params={{ id: String(t.id) }}><Info className="mr-2 h-4 w-4" />Detalhes</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FavoritesRail() {
  const { session } = useAuth();
  const [type, setType] = useState<MediaType | undefined>();
  const favs = useQuery({ queryKey: ["favorites"], queryFn: () => api<Favorite[]>("/favorites"), enabled: !!session });
  if (!session || favs.isLoading || favs.isError) return null;
  const all = (favs.data ?? []).map((f) => f.title).filter(Boolean);
  if (all.length === 0) return null;
  const items = type ? all.filter((t) => t.type === type) : all;
  return (
    <Rail title="Seus favoritos" filters={<TypeFilter value={type} onChange={setType} label="Filtrar favoritos" />} action={<Link to="/conta" className="text-sm text-secondary hover:underline">Ver conta</Link>}>
      {items.length ? items.map((t) => <TitleCard key={t.id} t={t} />) : <p className="!w-auto text-sm text-muted-foreground">Nenhum favorito deste tipo ainda.</p>}
    </Rail>
  );
}

function GenreRail({ genre }: { genre: Genre }) {
  const [type, setType] = useState<MediaType | undefined>();
  const base = useQuery({
    queryKey: ["titles", "genre", genre.id],
    queryFn: () => api<Paginated<Title>>(`/titles?genre_id=${genre.id}&limit=20`),
  });
  const filtered = useQuery({
    queryKey: ["titles", "genre", genre.id, type],
    queryFn: () => api<Paginated<Title>>(`/titles?genre_id=${genre.id}&type=${type}&limit=20`),
    enabled: Boolean(type),
  });
  const loading = type ? filtered.isLoading : base.isLoading;
  const items = (type ? filtered.data?.data : base.data?.data) ?? [];
  return (
    <Rail title={genre.name} filters={<TypeFilter value={type} onChange={setType} label={`Filtrar ${genre.name}`} />} action={<Link to="/catalogo" search={{ genre_id: genre.id, ...(type ? { type } : {}) }} className="text-sm text-primary hover:underline">Ver tudo</Link>}>
      {loading ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />) : items.length ? items.map((t) => <TitleCard key={t.id} t={t} />) : <p className="!w-auto text-sm text-muted-foreground">Nenhuma obra neste gênero por enquanto.</p>}
    </Rail>
  );
}
