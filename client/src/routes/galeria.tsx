import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArtCard } from "@/components/ArtCard";
import { api, qs, upload, type Art, type Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/galeria")({
  head: () => ({
    meta: [
      { title: "Galeria da Comunidade — GeekVerse" },
      { name: "description", content: "Fanarts e ilustrações originais publicadas pela comunidade GeekVerse." },
      { property: "og:title", content: "Galeria da Comunidade — GeekVerse" },
      { property: "og:description", content: "Descubra e curta artes da comunidade geek." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const { requireAuth } = useAuth();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const arts = useQuery({ queryKey: ["arts", term, page], queryFn: () => api<Paginated<Art>>(`/arts${qs({ q: term, page, limit: 30 })}`) });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-secondary">Comunidade</p>
          <h1 className="text-3xl font-extrabold">Galeria de Artes</h1>
        </div>
        <div className="flex gap-2">
          <form onSubmit={(e) => { e.preventDefault(); setTerm(q); setPage(1); }} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dust" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artes" className="w-56 bg-card pl-9" />
          </form>
          <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => requireAuth(() => setPublishing(true))}>
            <Plus className="mr-1 h-4 w-4" />Publicar
          </Button>
        </div>
      </div>
      {arts.isLoading && <div className="columns-2 gap-4 md:columns-3 lg:columns-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="mb-4 animate-pulse rounded-xl bg-card" style={{ height: 160 + (i % 3) * 80 }} />)}</div>}
      {arts.isError && <p className="text-destructive">{(arts.error as Error).message}</p>}
      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {arts.data?.data.map((a) => <ArtCard key={a.id} art={a} />)}
      </div>
      {arts.data && arts.data.data.length === 0 && <p className="py-16 text-center text-muted-foreground">Nenhuma arte por aqui ainda. Seja o primeiro!</p>}
      {arts.data && arts.data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="font-mono text-sm">{page} / {arts.data.total_pages}</span>
          <Button variant="outline" disabled={page >= arts.data.total_pages} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      )}
      <PublishDialog open={publishing} onOpenChange={setPublishing} />
    </div>
  );
}

function PublishDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Escolha uma imagem");
      const image_url = await upload("arts", file);
      return api("/arts", { method: "POST", json: { title, description, image_url } });
    },
    onSuccess: () => {
      toast.success("Arte publicada!");
      qc.invalidateQueries({ queryKey: ["arts"] });
      setFile(null); setTitle(""); setDescription(""); onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Publicar arte</DialogTitle></DialogHeader>
        <form id="pub" className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground hover:border-secondary">
            {file ? <img src={URL.createObjectURL(file)} alt="" className="max-h-56 rounded-md" /> : <><Upload className="h-6 w-6" />JPG, PNG, WEBP ou GIF (até 25MB)</>}
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="space-y-1.5"><Label>Título</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </form>
        <DialogFooter><Button form="pub" type="submit" disabled={m.isPending}>{m.isPending ? "Publicando…" : "Publicar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
