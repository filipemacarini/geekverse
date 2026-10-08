import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, upload, roleLabel, type Favorite, type Profile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ProfileView } from "@/components/ProfileView";

export const Route = createFileRoute("/conta")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Minha conta — GeekVerse" },
      { name: "description", content: "Gerencie seu perfil, favoritos e artes no GeekVerse." },
      { property: "og:title", content: "Minha conta — GeekVerse" },
      { property: "og:description", content: "Seu espaço no GeekVerse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Account,
});

function Account() {
  const { session, profile, loading, openLogin } = useAuth();
  const favs = useQuery({ queryKey: ["favorites"], queryFn: () => api<Favorite[]>("/favorites"), enabled: !!session });
  const pub = useQuery({ queryKey: ["profile", profile?.id], queryFn: () => api<Profile>(`/profiles/${profile!.id}`), enabled: !!profile });
  const [editing, setEditing] = useState(false);

  if (loading) return <div className="mx-auto h-40 max-w-7xl animate-pulse" />;
  if (!session) return (
    <div className="flex flex-col items-center gap-4 py-24">
      <p className="text-muted-foreground">Entre para ver sua conta.</p>
      <Button onClick={openLogin}>Entrar</Button>
    </div>
  );
  if (!profile) return <p className="p-10 text-center text-destructive">Não foi possível carregar seu perfil.</p>;

  return (
    <>
      <ProfileView
        profile={{ ...profile, arts: pub.data?.arts ?? [] }}
        favorites={(favs.data ?? []).map((f) => f.title).filter(Boolean)}
        extra={
          <div className="flex items-center gap-3">
            {profile.role && <span className="rounded-md border border-primary/40 px-2 py-1 font-mono text-xs text-primary">{roleLabel[profile.role]}</span>}
            <Button variant="outline" onClick={() => setEditing(true)}>Editar perfil</Button>
          </div>
        }
      />
      <EditProfile open={editing} onOpenChange={setEditing} profile={profile} />
    </>
  );
}

function EditProfile({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (v: boolean) => void; profile: Profile }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(profile.username);
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => { setUsername(profile.username); setAvatar(profile.avatar_url ?? ""); }, [profile]);
  const m = useMutation({
    mutationFn: async () => {
      const avatar_url = file ? await upload("arts", file) : avatar;
      return api("/profiles/me", { method: "PATCH", json: { username, avatar_url } });
    },
    onSuccess: () => { toast.success("Perfil atualizado"); qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["profile"] }); onOpenChange(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar perfil</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Nome de usuário</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Foto (enviar arquivo)</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5"><Label>…ou URL da foto</Label><Input value={avatar} onChange={(e) => setAvatar(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
