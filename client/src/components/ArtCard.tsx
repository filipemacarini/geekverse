import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, isModerator, type Art } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const likedKey = "gv-liked-arts";
function getLiked(): number[] {
  try { return JSON.parse(localStorage.getItem(likedKey) ?? "[]"); } catch { return []; }
}

export function ArtCard({ art }: { art: Art }) {
  const { profile, requireAuth } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [liked, setLiked] = useState(() => typeof window !== "undefined" && getLiked().includes(art.id));
  const [count, setCount] = useState(art.likes_count);
  const authorId = art.author?.id ?? art.profile_id;
  const canManage = !!profile && (profile.id === authorId || isModerator(profile.role));

  const like = useMutation({
    mutationFn: (on: boolean) => api(`/arts/${art.id}/likes/`, { method: on ? "POST" : "DELETE" }),
    onMutate: (on) => {
      setLiked(on); setCount((c) => c + (on ? 1 : -1));
      const l = getLiked().filter((x) => x !== art.id);
      localStorage.setItem(likedKey, JSON.stringify(on ? [...l, art.id] : l));
    },
    onError: (e, on) => { setLiked(!on); setCount((c) => c + (on ? -1 : 1)); toast.error((e as Error).message); },
  });

  const del = useMutation({
    mutationFn: () => api(`/arts/${art.id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Arte removida"); qc.invalidateQueries({ queryKey: ["arts"] }); setOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleLike = (e?: React.MouseEvent) => { e?.stopPropagation(); requireAuth(() => like.mutate(!liked)); };

  return (
    <>
      <div className="group relative mb-4 cursor-zoom-in break-inside-avoid overflow-hidden rounded-xl border border-border bg-card" onClick={() => setOpen(true)}>
        <img src={art.image_url} alt={art.title} loading="lazy" className="w-full" />
        <div className="absolute inset-0 flex flex-col justify-end bg-card-fade p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <h3 className="line-clamp-1 font-bold">{art.title}</h3>
          <div className="mt-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar className="h-6 w-6"><AvatarImage src={art.author?.avatar_url} /><AvatarFallback>{art.author?.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
              {art.author?.username}
            </span>
            <button onClick={toggleLike} className="flex items-center gap-1 font-mono text-xs">
              <Heart className={`h-4 w-4 ${liked ? "fill-secondary text-secondary" : ""}`} />{count}
            </button>
          </div>
        </div>
        {canManage && (
          <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-md bg-overlay p-1.5 backdrop-blur-md"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDel(true)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-border bg-theater p-0">
          <div className="grid md:grid-cols-[1fr_280px]">
            <img src={art.image_url} alt={art.title} className="max-h-[80vh] w-full object-contain" />
            <div className="space-y-4 p-5">
              <h2 className="text-xl font-bold">{art.title}</h2>
              {authorId && (
                <Link to="/perfil/$id" params={{ id: authorId }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Avatar className="h-8 w-8"><AvatarImage src={art.author?.avatar_url} /><AvatarFallback>{art.author?.username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  {art.author?.username}
                </Link>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">{art.description}</p>
              <Button variant="outline" onClick={() => toggleLike()} className="w-full">
                <Heart className={`mr-2 h-4 w-4 ${liked ? "fill-secondary text-secondary" : ""}`} /> {count} curtidas
              </Button>
              <p className="font-mono text-xs text-dust">{new Date(art.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditArtDialog art={art} open={editing} onOpenChange={setEditing} />

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent className="border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir esta arte?</AlertDialogTitle>
            <AlertDialogDescription>"{art.title}" será removida permanentemente da galeria.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => del.mutate()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditArtDialog({ art, open, onOpenChange }: { art: Art; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(art.title);
  const [description, setDescription] = useState(art.description);
  const m = useMutation({
    mutationFn: () => api(`/arts/${art.id}`, { method: "PATCH", json: { title, description } }),
    onSuccess: () => { toast.success("Arte atualizada"); qc.invalidateQueries({ queryKey: ["arts"] }); onOpenChange(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar arte</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
