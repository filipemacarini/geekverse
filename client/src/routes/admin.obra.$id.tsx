import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Upload, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, isStaff, upload, typeLabel, type Content, type Language, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/obra/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gerenciar conteúdos — GeekVerse" },
      { name: "description", content: "Edição em lote de episódios e volumes." },
      { property: "og:title", content: "Gerenciar conteúdos — GeekVerse" },
      { property: "og:description", content: "Painel de conteúdos do GeekVerse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManageContents,
});

type Row = Partial<Content> & { _key: string };
let k = 0;
const blankRow = (season = 1, episode = 1, language: Language = "sub"): Row => ({ _key: `n${k++}`, title: "", season, episode, language, source_url: "", cover_url: "" });

const cell = "w-full rounded bg-transparent px-1.5 py-1 text-sm outline-none focus:bg-card focus:ring-1 focus:ring-ring";

function ManageContents() {
  const { id } = Route.useParams();
  const { profile, loading } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["title", id], queryFn: () => api<Title>(`/titles/${id}`) });
  const [edits, setEdits] = useState<Record<number, Partial<Content>>>({});
  const [newRows, setNewRows] = useState<Row[]>([]);

  const inv = () => qc.invalidateQueries({ queryKey: ["title", id] });
  const t = q.data;
  const isNovel = t?.type === "novel";

  const saveAll = useMutation({
    mutationFn: async () => {
      const patch = Object.entries(edits).map(([cid, v]) => ({ id: Number(cid), ...v }));
      if (patch.length) await api("/contents", { method: "PATCH", json: patch });
      if (newRows.length) {
        const body = newRows.map(({ _key, id: _id, ...r }) => {
          const item: Record<string, unknown> = { ...r, season: Number(r.season), episode: Number(r.episode) };
          if (isNovel) { item["language"] = "none"; delete item["episode"]; } else delete item["cover_url"];
          if (!item["source_url"]) throw new Error(isNovel ? "Envie o arquivo de cada volume" : "Preencha o link de vídeo de cada episódio");
          return item;
        });
        await api(`/titles/${id}/contents`, { method: "POST", json: body });
      }
    },
    onSuccess: () => { toast.success("Alterações salvas"); setEdits({}); setNewRows([]); inv(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (cid: number) => api(`/contents/${cid}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Conteúdo removido"); inv(); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (loading || q.isLoading) return <div className="p-10" />;
  if (!isStaff(profile?.role)) return <p className="p-16 text-center text-muted-foreground">Acesso restrito.</p>;
  if (!t) return <p className="p-10 text-destructive">Obra não encontrada</p>;

  const existing = [...(t.contents ?? [])].sort((a, b) => a.season - b.season || a.episode - b.episode);
  const pending = Object.keys(edits).length + newRows.length;
  const val = <K extends keyof Content>(c: Content, key: K) => (edits[c.id]?.[key] ?? c[key]) as Content[K];
  const edit = (cid: number, patch: Partial<Content>) => setEdits((e) => ({ ...e, [cid]: { ...e[cid], ...patch } }));
  const editNew = (key: string, patch: Partial<Row>) => setNewRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)));

  const addRow = () => {
    const last = newRows[newRows.length - 1] ?? existing[existing.length - 1];
    if (isNovel) {
      const { episode: _ep, ...row } = blankRow((Number(last?.season) || 0) + 1, 1, "none");
      setNewRows((rs) => [...rs, row]);
    } else {
      setNewRows((rs) => [...rs, blankRow(last?.season ?? 1, (Number(last?.episode) || 0) + 1, (last?.language as Language) ?? "sub")]);
    }
  };

  const uploadTo = async (file: File | undefined, kind: "arts" | "novels", apply: (url: string) => void) => {
    if (!file) return;
    try { apply(await upload(kind, file)); toast.success("Arquivo enviado"); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-28 md:px-8">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Painel</Link>
      <div className="flex items-center gap-4">
        <img src={t.cover_url} alt="" className="h-20 w-14 rounded-md object-cover" />
        <div>
          <p className="font-mono text-xs text-primary">{typeLabel[t.type]}</p>
          <h1 className="text-2xl font-extrabold">{t.name}</h1>
          <p className="text-sm text-muted-foreground">{isNovel ? "Volumes" : t.type === "anime" ? "Episódios" : "Capítulos"}</p>
        </div>
      </div>

      {t.type === "manga" ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-6 text-muted-foreground">
          <Lock className="h-5 w-5 text-primary" />
          Os capítulos desta obra são sincronizados e gerenciados via integração com o MangaDex.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-card text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-20 p-2">{isNovel ? "Volume" : "Temp."}</th>
                  {!isNovel && <th className="w-20 p-2">Ep.</th>}
                  <th className="p-2">Título</th>
                  {!isNovel && <th className="w-28 p-2">Idioma</th>}
                  <th className="p-2">{isNovel ? "Arquivo (PDF/EPUB)" : "Link do vídeo"}</th>
                  {isNovel && <th className="w-40 p-2">Capa</th>}
                  <th className="w-10 p-2" />
                </tr>
              </thead>
              <tbody>
                {existing.map((c) => (
                  <tr key={c.id} className={`border-t border-border even:bg-muted/30 ${edits[c.id] ? "bg-primary/5" : ""}`}>
                    <td className="p-1"><input type="number" className={cell} value={val(c, "season")} onChange={(e) => edit(c.id, { season: Number(e.target.value) })} /></td>
                    {!isNovel && <td className="p-1"><input type="number" step="0.5" className={cell} value={val(c, "episode")} onChange={(e) => edit(c.id, { episode: Number(e.target.value) })} /></td>}
                    <td className="p-1"><input className={cell} value={val(c, "title")} onChange={(e) => edit(c.id, { title: e.target.value })} /></td>
                    {!isNovel && (
                      <td className="p-1">
                        <select className={cell} value={val(c, "language")} onChange={(e) => edit(c.id, { language: e.target.value as Language })}>
                          <option value="sub">SUB</option><option value="dub">DUB</option>
                        </select>
                      </td>
                    )}
                    <td className="p-1">
                      {isNovel ? (
                        <FileCell url={val(c, "source_url")} accept=".pdf,.epub" onFile={(f) => uploadTo(f, "novels", (u) => edit(c.id, { source_url: u }))} />
                      ) : (
                        <input className={cell} value={val(c, "source_url")} onChange={(e) => edit(c.id, { source_url: e.target.value })} />
                      )}
                    </td>
                    {isNovel && <td className="p-1"><FileCell url={val(c, "cover_url")} accept="image/*" onFile={(f) => uploadTo(f, "arts", (u) => edit(c.id, { cover_url: u }))} /></td>}
                    <td className="p-1"><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
                {newRows.map((r) => (
                  <tr key={r._key} className="border-t border-border bg-sub/5">
                    <td className="p-1"><input type="number" className={cell} value={r.season} onChange={(e) => editNew(r._key, { season: Number(e.target.value) })} /></td>
                    {!isNovel && <td className="p-1"><input type="number" step="0.5" className={cell} value={r.episode} onChange={(e) => editNew(r._key, { episode: Number(e.target.value) })} /></td>}
                    <td className="p-1"><input className={cell} placeholder="Título" value={r.title} onChange={(e) => editNew(r._key, { title: e.target.value })} /></td>
                    {!isNovel && (
                      <td className="p-1">
                        <select className={cell} value={r.language} onChange={(e) => editNew(r._key, { language: e.target.value as Language })}>
                          <option value="sub">SUB</option><option value="dub">DUB</option>
                        </select>
                      </td>
                    )}
                    <td className="p-1">
                      {isNovel ? (
                        <FileCell url={r.source_url} accept=".pdf,.epub" onFile={(f) => uploadTo(f, "novels", (u) => editNew(r._key, { source_url: u }))} />
                      ) : (
                        <input className={cell} placeholder="https://…" value={r.source_url} onChange={(e) => editNew(r._key, { source_url: e.target.value })} />
                      )}
                    </td>
                    {isNovel && <td className="p-1"><FileCell url={r.cover_url} accept="image/*" onFile={(f) => uploadTo(f, "arts", (u) => editNew(r._key, { cover_url: u }))} /></td>}
                    <td className="p-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setNewRows((rs) => rs.filter((x) => x._key !== r._key))}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="outline" onClick={addRow}><Plus className="mr-1 h-4 w-4" />Adicionar {isNovel ? "volume" : "episódio"}</Button>
        </>
      )}

      {pending > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
            <span className="text-sm text-muted-foreground">{pending} alteração(ões) pendente(s)</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setEdits({}); setNewRows([]); }}>Descartar</Button>
              <Button className="shadow-glow" onClick={() => saveAll.mutate()} disabled={saveAll.isPending}>Salvar em lote</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileCell({ url, accept, onFile }: { url?: string | undefined; accept: string; onFile: (f?: File) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-card">
      <Upload className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{url ? url.split("/").pop() : "Enviar"}</span>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  );
}
