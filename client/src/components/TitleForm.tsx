import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, upload, type Genre, type MediaType, type Title } from "@/lib/api";

export function TitleForm({ initial, onDone }: { initial?: Title | undefined; onDone: () => void }) {
  const qc = useQueryClient();
  const genres = useQuery({ queryKey: ["genres"], queryFn: () => api<Genre[]>("/genres") });
  const [type, setType] = useState<MediaType | "">(initial?.type ?? "");
  const [f, setF] = useState({
    name: initial?.name ?? "",
    synopsis: initial?.synopsis ?? "",
    cover_url: initial?.cover_url ?? "",
    banner_url: initial?.banner_url ?? "",
    age_rating: initial?.age_rating ?? "L",
    status: initial?.status ?? "releasing",
    source: initial?.source ?? "",
    publication_year: initial?.publication_year ?? new Date().getFullYear(),
  });
  const [genreIds, setGenreIds] = useState<number[]>(initial?.genres?.map((g) => g.id) ?? []);
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  const m = useMutation({
    mutationFn: async () => {
      if (!type) throw new Error("Escolha o tipo da obra");
      const payload: Record<string, unknown> = { ...f, type, publication_year: Number(f.publication_year), genre_ids: genreIds };
      if (type !== "manga") delete payload["source"];
      else if (!f.source) throw new Error("Informe o ID do MangaDex");
      return initial
        ? api(`/titles/${initial.id}`, { method: "PATCH", json: payload })
        : api("/titles", { method: "POST", json: payload });
    },
    onSuccess: () => {
      toast.success(initial ? "Obra atualizada" : "Obra criada");
      qc.invalidateQueries({ queryKey: ["titles"] });
      if (initial) qc.invalidateQueries({ queryKey: ["title", String(initial.id)] });
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const uploadInto = async (k: "cover_url" | "banner_url", file?: File) => {
    if (!file) return;
    try { set(k, await upload("arts", file)); toast.success("Imagem enviada"); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <div className="space-y-1.5">
        <Label>Tipo *</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["anime", "manga", "novel"] as MediaType[]).map((t) => (
            <button type="button" key={t} onClick={() => setType(t)}
              className={`rounded-lg border p-3 text-sm font-semibold ${type === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
              {t === "anime" ? "Anime" : t === "manga" ? "Mangá" : "Novel"}
            </button>
          ))}
        </div>
      </div>
      {type && (
        <>
          {type === "manga" && (
            <div className="space-y-1.5"><Label>ID do MangaDex (source) *</Label><Input required value={f.source} onChange={(e) => set("source", e.target.value)} /></div>
          )}
          <div className="space-y-1.5"><Label>Nome *</Label><Input required value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Sinopse</Label><Textarea rows={4} value={f.synopsis} onChange={(e) => set("synopsis", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["cover_url", "banner_url"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label>{k === "cover_url" ? "Capa" : "Banner"}</Label>
                <Input placeholder="URL" value={f[k]} onChange={(e) => set(k, e.target.value)} />
                <Input type="file" accept="image/*" onChange={(e) => uploadInto(k, e.target.files?.[0])} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Classificação</Label>
              <Select value={f.age_rating} onValueChange={(v) => set("age_rating", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["L", "12", "14", "16", "18"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="releasing">Em lançamento</SelectItem><SelectItem value="completed">Completo</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Ano</Label><Input type="number" value={f.publication_year} onChange={(e) => set("publication_year", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Gêneros</Label>
            <div className="flex flex-wrap gap-2">
              {genres.data?.map((g) => {
                const on = genreIds.includes(g.id);
                return (
                  <button type="button" key={g.id} onClick={() => setGenreIds(on ? genreIds.filter((x) => x !== g.id) : [...genreIds, g.id])}
                    className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending}>{initial ? "Salvar alterações" : "Criar obra"}</Button>
        </>
      )}
    </form>
  );
}
