import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArtCard } from "@/components/ArtCard";
import { TitleCard } from "@/components/TitleCard";
import type { Profile, Title } from "@/lib/api";

export function ProfileView({ profile, favorites, extra }: { profile: Profile; favorites: Title[]; extra?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 md:px-8">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar className="h-24 w-24 border-2 border-secondary/50">
          <AvatarImage src={profile.avatar_url} />
          <AvatarFallback className="text-3xl">{profile.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">{profile.username}</h1>
          <p className="font-mono text-sm text-muted-foreground">Membro desde {new Date(profile.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
        {extra}
      </div>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Obras favoritas</h2>
        {favorites.length ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{favorites.map((t) => <TitleCard key={t.id} t={t} />)}</div>
        ) : <p className="text-muted-foreground">Nenhuma obra favoritada.</p>}
      </section>
      {profile.arts !== undefined && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Artes <span className="font-mono text-sm text-muted-foreground">({profile.arts.length})</span></h2>
          {profile.arts.length ? (
            <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
              {profile.arts.map((a) => <ArtCard key={a.id} art={{ ...a, author: a.author ?? { id: profile.id, username: profile.username, avatar_url: profile.avatar_url } }} />)}
            </div>
          ) : <p className="text-muted-foreground">Nenhuma arte publicada.</p>}
        </section>
      )}
    </div>
  );
}
