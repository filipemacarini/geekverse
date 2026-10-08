import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProfileView } from "@/components/ProfileView";
import { api, type Favorite, type Profile, type Title } from "@/lib/api";

export const Route = createFileRoute("/perfil/$id")({
  head: () => ({
    meta: [
      { title: "Perfil — GeekVerse" },
      { name: "description", content: "Artes e obras favoritas de um membro da comunidade GeekVerse." },
      { property: "og:title", content: "Perfil — GeekVerse" },
      { property: "og:description", content: "Conheça este artista da comunidade GeekVerse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();
  const p = useQuery({ queryKey: ["profile", id], queryFn: () => api<Profile>(`/profiles/${id}`) });
  const favs = useQuery({ queryKey: ["profile-favs", id], queryFn: () => api<(Favorite | Title)[]>(`/profiles/${id}/favorites`) });
  if (p.isLoading) return <div className="mx-auto h-40 max-w-7xl animate-pulse" />;
  if (!p.data) return <p className="p-10 text-center text-destructive">Perfil não encontrado</p>;
  const titles = (favs.data ?? []).map((f) => ("title" in f && f.title ? f.title : f) as Title);
  return <ProfileView profile={p.data} favorites={titles} />;
}

