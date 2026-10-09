import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { Heart, Play, BookOpen, X, Download, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, isStaff, typeLabel, type Content, type Favorite, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { createServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/obra/$id")({
  validateSearch: z.object({ c: z.string().or(z.number()).optional() }),
  head: () => ({
    meta: [
      { title: "Obra — GeekVerse" },
      { name: "description", content: "Detalhes, episódios, capítulos e volumes da obra no GeekVerse." },
      { property: "og:title", content: "Obra — GeekVerse" },
      { property: "og:description", content: "Assista ou leia esta obra no GeekVerse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TitlePage,
});

type ViewContent = Omit<Content, "id"> & { id: number | string };

interface MdChapter {
  id: string;
  attributes: {
    chapter: string | null;
    volume: string | null;
    title: string | null;
    pages: number;
    externalUrl: string | null;
  };
}

// 1. Busca os capítulos no MangaDex rodando no SERVIDOR (Zero CORS!)
const fetchMangaChapters = createServerFn({ method: "GET" })
  .validator((mangaId: string) => mangaId)
  .handler(async ({ data: mangaId }) => {
    const url = `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=pt-br&translatedLanguage[]=pt&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&order[chapter]=asc&limit=500`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "GeekVerse/1.0 (contact@geekverse.com)",
      },
    });
    if (!r.ok) {
      throw new Error(`Falha ao buscar capítulos no MangaDex (Status ${r.status})`);
    }
    return (await r.json()) as { data: MdChapter[] };
  });

// 2. Busca as páginas do leitor no MangaDex rodando no SERVIDOR (Zero CORS!)
const fetchMangaPages = createServerFn({ method: "GET" })
  .validator((chapterId: string) => chapterId)
  .handler(async ({ data: chapterId }) => {
    const r = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`, {
      headers: {
        "User-Agent": "GeekVerse/1.0 (contact@geekverse.com)",
      },
    });
    if (!r.ok) {
      throw new Error(`Falha ao carregar páginas no MangaDex (Status ${r.status})`);
    }
    return (await r.json()) as { baseUrl: string; chapter: { hash: string; data: string[] } };
  });

function TitlePage() {
  const { id } = Route.useParams();
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: "/obra/$id" });
  const { session, profile, requireAuth } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["title", id], queryFn: () => api<Title>(`/titles/${id}`) });
  const favs = useQuery({ queryKey: ["favorites"], queryFn: () => api<Favorite[]>("/favorites"), enabled: !!session });
  const isFav = !!favs.data?.some((f) => f.title_id === Number(id));
  const [lang, setLang] = useState<"all" | "sub" | "dub">("all");

  const fav = useMutation({
    mutationFn: () => api(`/favorites/${id}`, { method: isFav ? "DELETE" : "POST" }),
    onSuccess: () => {
      toast.success(isFav ? "Removido dos favoritos" : "Adicionado aos favoritos");
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const t = q.data;
  const isManga = t?.type === "manga";

  // Sanitização do ID do MangaDex (extrai UUID caso tenha link completo)
  const mangaId = useMemo(() => {
    if (!t?.source) return undefined;
    const match = t.source.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return match ? match[0] : t.source.trim();
  }, [t?.source]);

  const md = useQuery({
    queryKey: ["mangadex-feed", mangaId],
    enabled: isManga && Boolean(mangaId),
    queryFn: async () => {
      const j = await fetchMangaChapters({ data: mangaId! });
      const seen = new Set<string>();
      return j.data
        .filter((x) => x.attributes.pages > 0 && !x.attributes.externalUrl)
        .filter((x) => {
          const k = x.attributes.chapter ?? x.id;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((x): ViewContent => ({
          id: x.id,
          title_id: t!.id,
          title: x.attributes.title ?? "",
          season: Number(x.attributes.volume) || 1,
          episode: Number(x.attributes.chapter) || 0,
          language: "none",
          source_url: "",
        }));
    },
  });

  const sortedContents: ViewContent[] = useMemo(
    () =>
      isManga
        ? md.data ?? []
        : [...(t?.contents ?? [])].sort(
            (a, b) =>
              a.season - b.season ||
              (a.episode ?? 0) - (b.episode ?? 0) ||
              String(a.id).localeCompare(String(b.id)),
          ),
    [t, isManga, md.data],
  );

  const contents = lang === "all" ? sortedContents : sortedContents.filter((x) => x.language === lang);
  const active = c === undefined ? undefined : sortedContents.find((x) => String(x.id) === String(c));
  const firstContent = contents[0];

  const goToAdjacent = (direction: -1 | 1) => {
    if (!active) return;
    const sameLanguage = sortedContents.filter((x) => x.language === active.language);
    const index = sameLanguage.findIndex((x) => x.id === active.id);
    const next = sameLanguage[index + direction];
    if (!next) {
      toast.info(
        t?.type === "manga"
          ? direction === 1
            ? "Este é o último capítulo."
            : "Este é o primeiro capítulo."
          : direction === 1
            ? "Este é o último episódio desta versão."
            : "Este é o primeiro episódio desta versão.",
      );
      return;
    }
    navigate({ search: { c: next.id } });
  };

  const episodeCard = (x: ViewContent) => (
    <Button
      key={x.id}
      variant="outline"
      onClick={() => navigate({ search: { c: x.id } })}
      className="flex h-auto min-h-18 w-full items-center justify-start gap-3 rounded-lg border-border bg-card p-3 text-left font-normal transition-colors hover:border-primary/40 hover:bg-surface-hover"
    >
      {x.cover_url ? (
        <img src={x.cover_url} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-sm text-primary">
          {t?.type === "novel" ? x.season : x.episode}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {x.title || `${t?.type === "novel" ? "Volume" : t?.type === "anime" ? "Episódio" : "Capítulo"} ${t?.type === "novel" ? x.season : x.episode}`}
        </span>
        {t?.type !== "novel" && (
          <span className="block font-mono text-xs text-muted-foreground">
            {t?.type === "anime" ? "Episódio" : "Capítulo"} {x.episode}
          </span>
        )}
      </span>
      {x.language !== "none" && (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-secondary-foreground ${x.language === "sub" ? "bg-sub" : "bg-dub"}`}
        >
          {x.language.toUpperCase()}
        </span>
      )}
    </Button>
  );

  const episodeGroups = (items: ViewContent[], singleColumn = false) =>
    [...new Set(items.map((x) => x.season))].map((s) => (
      <div key={s} className="space-y-2">
        {t?.type !== "manga" && new Set(items.map((x) => x.season)).size > 1 && (
          <h3 className="font-mono text-sm text-muted-foreground">
            {t?.type === "novel" ? "Volume" : "Temporada"} {s}
          </h3>
        )}
        <div className={`grid gap-2 ${singleColumn ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {items.filter((x) => x.season === s).map(episodeCard)}
        </div>
      </div>
    ));

  if (q.isLoading) return <div className="h-[60vh] animate-pulse bg-card" />;
  if (q.isError || !t) return <p className="p-10 text-center text-destructive">{(q.error as Error)?.message ?? "Obra não encontrada"}</p>;

  const unit = t.type === "anime" ? "Episódio" : t.type === "novel" ? "Volume" : "Capítulo";

  return (
    <div className="pb-16">
      {active && (
        <Viewer
          t={t}
          content={active}
          onClose={() => navigate({ search: {} })}
          onPrevious={() => goToAdjacent(-1)}
          onNext={() => goToAdjacent(1)}
        />
      )}
      <section className="relative h-[46vh] min-h-[320px] overflow-hidden">
        <img src={t.banner_url || t.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-fade" />
      </section>
      <div className="relative mx-auto -mt-48 grid max-w-7xl gap-8 px-4 md:grid-cols-[220px_1fr] md:px-8">
        <img src={t.cover_url} alt={t.name} className="aspect-[2/3] w-44 rounded-xl border border-border object-cover shadow-glow md:w-full" />
        <div className="space-y-4 md:pt-24">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-primary">{typeLabel[t.type]}</span>
            <span className="rounded-md border border-border px-2 py-0.5">{t.age_rating === "L" ? "Livre" : `${t.age_rating}+`}</span>
            <span className="rounded-md border border-border px-2 py-0.5">{t.status === "releasing" ? "Em lançamento" : "Completo"}</span>
            <span className="text-muted-foreground">{t.publication_year}</span>
          </div>
          <h1 className="text-3xl font-extrabold md:text-5xl">{t.name}</h1>
          <div className="flex flex-wrap gap-2">
            {t.genres?.map((g) => (
              <Link key={g.id} to="/catalogo" search={{ genre_id: g.id }} className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                {g.name}
              </Link>
            ))}
          </div>
          <p className="max-w-3xl leading-relaxed text-muted-foreground">{t.synopsis}</p>
          <div className="flex flex-wrap gap-3">
            {firstContent && (
              <Button size="lg" className="shadow-glow" onClick={() => navigate({ search: { c: firstContent.id } })}>
                {t.type === "anime" ? <Play className="mr-2 h-4 w-4 fill-current" /> : <BookOpen className="mr-2 h-4 w-4" />}
                {t.type === "anime" ? "Assistir" : "Começar a ler"}
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={() => requireAuth(() => fav.mutate())}>
              <Heart className={`mr-2 h-4 w-4 ${isFav ? "fill-primary text-primary" : ""}`} />
              {isFav ? "Favoritado" : "Favoritar"}
            </Button>
            {isStaff(profile?.role) && (
              <Button size="lg" variant="ghost" asChild>
                <Link to="/admin/obra/$id" params={{ id }}>
                  <Pencil className="mr-2 h-4 w-4" />Gerenciar
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <section className="mx-auto mt-12 max-w-7xl space-y-5 px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">
            {unit}s <span className="font-mono text-sm text-muted-foreground">({contents.length})</span>
          </h2>
          {t.type === "anime" && (
            <div className="flex gap-1 rounded-lg bg-card p-1 text-xs">
              {(["all", "sub", "dub"] as const).map((l) => (
                <Button key={l} size="sm" variant={lang === l ? "secondary" : "ghost"} onClick={() => setLang(l)} className="h-7 px-3 text-xs">
                  {l === "all" ? "Todos" : l === "sub" ? "Legendado" : "Dublado"}
                </Button>
              ))}
            </div>
          )}
        </div>
        {contents.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            {t.type === "manga"
              ? md.isLoading
                ? "Carregando capítulos do MangaDex..."
                : md.isError
                  ? "Não foi possível carregar os capítulos do MangaDex."
                  : !t.source
                    ? "Esta obra não tem ID do MangaDex cadastrado."
                    : "Nenhum capítulo em português disponível no MangaDex."
              : `Nenhum ${unit.toLowerCase()} disponível ainda.`}
          </p>
        )}
        {t.type === "anime" && lang === "all" ? (
          <div className="grid gap-8 md:grid-cols-2">
            {(["dub", "sub"] as const).map((language) => (
              <div key={language} className="min-w-0 space-y-4">
                <h3 className="border-b border-border pb-2 text-lg font-semibold">
                  {language === "dub" ? "Dublados" : "Legendados"}{" "}
                  <span className="font-mono text-sm text-muted-foreground">
                    ({contents.filter((x) => x.language === language).length})
                  </span>
                </h3>
                {contents.some((x) => x.language === language) ? (
                  episodeGroups(contents.filter((x) => x.language === language), true)
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum episódio disponível.</p>
                )}
              </div>
            ))}
            {contents.some((x) => x.language === "none") && (
              <div className="space-y-4 md:col-span-2">
                <h3 className="border-b border-border pb-2 text-lg font-semibold">Outros</h3>
                {episodeGroups(contents.filter((x) => x.language === "none"))}
              </div>
            )}
          </div>
        ) : (
          episodeGroups(contents)
        )}
      </section>
    </div>
  );
}

function Viewer({
  t,
  content,
  onClose,
  onPrevious,
  onNext,
}: {
  t: Title;
  content: ViewContent;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const url = content.source_url;
  const isVideoFile = /\.(mp4|webm|m3u8|ogg)(\?|$)/i.test(url);
  const isPdf = /\.pdf(\?|$)/i.test(url);
  const isEpub = /\.epub(\?|$)/i.test(url);
  const [mode, setMode] = useState<ReadMode>("vertical");

  useEffect(() => {
    const m = localStorage.getItem("gv-read-mode");
    if (m === "vertical" || m === "ltr" || m === "rtl") setMode(m);
  }, []);

  useEffect(() => {
    localStorage.setItem("gv-read-mode", mode);
  }, [mode]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-theater">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-muted-foreground">{t.name}</p>
          <p className="truncate font-semibold">{content.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {t.type === "manga" && (
            <Select value={mode} onValueChange={(v) => setMode(v as ReadMode)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">Cascata</SelectItem>
                <SelectItem value="ltr">Folhear (Esq ➔ Dir)</SelectItem>
                <SelectItem value="rtl">Folhear (Dir ➔ Esq)</SelectItem>
              </SelectContent>
            </Select>
          )}
          {(t.type === "anime" || t.type === "manga") && (
            <>
              <Button variant="ghost" size="sm" onClick={onPrevious} aria-label="Anterior" title="Anterior">
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={onNext} aria-label="Próximo" title="Próximo">
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {(isPdf || isEpub) && (
            <Button variant="ghost" size="sm" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <Download className="mr-1 h-4 w-4" />Baixar
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className={`flex flex-1 items-center justify-center p-2 md:p-6 ${t.type === "manga" ? "overflow-y-auto" : "overflow-hidden"}`}>
        {t.type === "manga" ? (
          <MangaReader key={String(content.id)} chapterId={String(content.id)} mode={mode} />
        ) : t.type === "anime" ? (
          isVideoFile ? (
            <video key={content.id} src={url} controls autoPlay className="max-h-full w-full max-w-6xl rounded-lg" />
          ) : (
            <iframe key={content.id} src={url} title={content.title} allowFullScreen className="aspect-video w-full max-w-6xl rounded-lg border-0" />
          )
        ) : isEpub ? (
          <div className="max-w-md space-y-4 text-center font-serif">
            <p className="leading-loose text-muted-foreground">Este volume está em formato EPUB. Baixe para ler no seu leitor favorito.</p>
            <Button asChild>
              <a href={url} target="_blank" rel="noreferrer">Abrir EPUB</a>
            </Button>
          </div>
        ) : (
          <iframe src={url} title={content.title} className="h-full w-full max-w-5xl rounded-lg border-0 bg-card" />
        )}
      </div>
    </div>
  );
}

type ReadMode = "vertical" | "ltr" | "rtl";

function MangaReader({ chapterId, mode }: { chapterId: string; mode: ReadMode }) {
  const [page, setPage] = useState(0);
  const pages = useQuery({
    queryKey: ["mangadex-pages", chapterId],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const j = await fetchMangaPages({ data: chapterId });
      return j.chapter.data.map((f) => `${j.baseUrl}/data/${j.chapter.hash}/${f}`);
    },
  });

  const list = pages.data ?? [];
  const go = (d: number) => setPage((p) => Math.min(Math.max(p + d, 0), list.length - 1));

  useEffect(() => {
    if (mode === "vertical") return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(mode === "ltr" ? 1 : -1);
      if (e.key === "ArrowLeft") go(mode === "ltr" ? -1 : 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (pages.isLoading) return <p className="text-muted-foreground">Carregando páginas...</p>;
  if (pages.isError) return <p className="text-destructive">{(pages.error as Error).message}</p>;

  if (mode === "vertical")
    return (
      <div className="flex h-full w-full max-w-3xl flex-col self-start">
        {list.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Página ${i + 1}`}
            loading={i < 3 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            className="w-full"
          />
        ))}
      </div>
    );

  const left = () => go(mode === "ltr" ? -1 : 1);
  const right = () => go(mode === "ltr" ? 1 : -1);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2">
      <div className="relative flex h-full min-h-0 w-full items-center justify-center">
        {list[page] && (
          <img
            src={list[page]}
            alt={`Página ${page + 1}`}
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain"
          />
        )}
        <button type="button" aria-label="Página à esquerda" onClick={left} className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize" />
        <button type="button" aria-label="Página à direita" onClick={right} className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize" />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={left}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          {page + 1} / {list.length}
        </span>
        <Button variant="ghost" size="sm" onClick={right}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}