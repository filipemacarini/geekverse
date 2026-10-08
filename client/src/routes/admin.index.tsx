import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, ListVideo } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { TitleForm } from "@/components/TitleForm";
import { api, isStaff, roleLabel, typeLabel, type Genre, type Paginated, type Profile, type Role, type Title } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel — GeekVerse" },
      { name: "description", content: "Gestão do catálogo, gêneros e equipe do GeekVerse." },
      { property: "og:title", content: "Painel — GeekVerse" },
      { property: "og:description", content: "Painel administrativo do GeekVerse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { profile, loading } = useAuth();
  if (loading) return <div className="p-10" />;
  if (!isStaff(profile?.role)) return <p className="p-16 text-center text-muted-foreground">Acesso restrito à equipe de conteúdo.</p>;
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <h1 className="text-3xl font-extrabold">Painel</h1>
      <Tabs defaultValue="titles">
        <TabsList>
          <TabsTrigger value="titles">Obras</TabsTrigger>
          <TabsTrigger value="genres">Gêneros</TabsTrigger>
          {profile?.role === "admin" && <TabsTrigger value="team">Equipe</TabsTrigger>}
        </TabsList>
        <TabsContent value="titles"><TitlesTab /></TabsContent>
        <TabsContent value="genres"><GenresTab /></TabsContent>
        {profile?.role === "admin" && <TabsContent value="team"><TeamTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

function TitlesTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Title | null | "new">(null);
  const [del, setDel] = useState<Title | null>(null);
  const titles = useQuery({ queryKey: ["titles", "admin", q], queryFn: () => api<Paginated<Title>>(`/titles?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`) });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/titles/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Obra removida"); qc.invalidateQueries({ queryKey: ["titles"] }); setDel(null); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-4 pt-4">
      <div className="flex gap-2">
        <Input placeholder="Filtrar obras" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-card" />
        <Button className="ml-auto" onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" />Nova obra</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-2">Obra</th><th className="p-2">Tipo</th><th className="p-2">Ano</th><th className="p-2">Status</th><th className="p-2 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {titles.data?.data.map((t) => (
              <tr key={t.id} className="border-t border-border even:bg-muted/30">
                <td className="p-2"><div className="flex items-center gap-2"><img src={t.cover_url} alt="" className="h-10 w-7 rounded object-cover" /><span className="font-semibold">{t.name}</span></div></td>
                <td className="p-2">{typeLabel[t.type]}</td>
                <td className="p-2 font-mono">{t.publication_year}</td>
                <td className="p-2">{t.status === "releasing" ? "Em lançamento" : "Completo"}</td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" asChild title="Conteúdos"><Link to="/admin/obra/$id" params={{ id: String(t.id) }}><ListVideo className="h-4 w-4" /></Link></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDel(t)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === "new" ? "Nova obra" : "Editar obra"}</DialogTitle></DialogHeader>
          {editing && <TitleForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!del} onOpenChange={(v) => !v && setDel(null)}>
        <DialogContent className="border-destructive/50">
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir “{del?.name}”?</DialogTitle>
            <DialogDescription>Todos os episódios, capítulos e volumes serão removidos.</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="destructive" onClick={() => del && remove.mutate(del.id)}>Excluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GenresTab() {
  const qc = useQueryClient();
  const genres = useQuery({ queryKey: ["genres"], queryFn: () => api<Genre[]>("/genres") });
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [newNames, setNewNames] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["genres"] });
  const save = useMutation({
    mutationFn: () => api("/genres", { method: "PATCH", json: Object.entries(edits).map(([id, name]) => ({ id: Number(id), name })) }),
    onSuccess: () => { toast.success("Gêneros atualizados"); setEdits({}); inv(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const add = useMutation({
    mutationFn: () => api("/genres", { method: "POST", json: newNames.split(",").map((n) => n.trim()).filter(Boolean).map((name) => ({ name })) }),
    onSuccess: () => { toast.success("Gêneros criados"); setNewNames(""); inv(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/genres/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Gênero removido"); inv(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="max-w-xl space-y-4 pt-4">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Input placeholder="Novos gêneros, separados por vírgula" value={newNames} onChange={(e) => setNewNames(e.target.value)} className="bg-card" />
        <Button type="submit" disabled={!newNames.trim()}>Adicionar</Button>
      </form>
      <div className="divide-y divide-border rounded-xl border border-border">
        {genres.data?.map((g) => (
          <div key={g.id} className="flex items-center gap-2 p-1.5 even:bg-muted/30">
            <span className="w-10 text-center font-mono text-xs text-dust">{g.id}</span>
            <input value={edits[g.id] ?? g.name} onChange={(e) => setEdits({ ...edits, [g.id]: e.target.value })}
              className="flex-1 rounded-md bg-transparent px-2 py-1 text-sm outline-none focus:bg-card focus:ring-1 focus:ring-ring" />
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      {Object.keys(edits).length > 0 && (
        <div className="sticky bottom-4 flex justify-end"><Button className="shadow-glow" onClick={() => save.mutate()}>Salvar {Object.keys(edits).length} alteração(ões)</Button></div>
      )}
    </div>
  );
}

function TeamTab() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["profiles"], queryFn: () => api<Profile[]>("/profiles") });
  const [target, setTarget] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role>("user");
  const m = useMutation({
    mutationFn: () => api(`/profiles/${target!.id}/role`, { method: "PATCH", json: { role } }),
    onSuccess: () => { toast.success(`Cargo de ${target?.username} atualizado`); qc.invalidateQueries({ queryKey: ["profiles"] }); setTarget(null); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="pt-4">
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-2">Membro</th><th className="p-2">E-mail</th><th className="p-2">Cargo</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-t border-border even:bg-muted/30">
                <td className="p-2"><div className="flex items-center gap-2"><Avatar className="h-7 w-7"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>{u.username}</div></td>
                <td className="p-2 text-muted-foreground">{u.email}</td>
                <td className="p-2 font-mono text-xs">{u.role ? roleLabel[u.role] : "—"}</td>
                <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => { setTarget(u); setRole(u.role ?? "user"); }}>Alterar cargo</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar cargo</DialogTitle>
            <DialogDescription>{target?.username} · {target?.email}</DialogDescription>
          </DialogHeader>
          <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="space-y-2">
            {(["user", "moderator", "content_manager"] as Role[]).map((r) => (
              <Label key={r} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary">
                <RadioGroupItem value={r} />{r === "user" ? "Usuário Padrão" : roleLabel[r]}
              </Label>
            ))}
          </RadioGroup>
          <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
