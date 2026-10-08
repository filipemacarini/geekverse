import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, LogOut, User, Shield, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { isStaff, roleLabel } from "@/lib/api";

const nav = [
  { to: "/", label: "Início" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/galeria", label: "Galeria" },
] as const;

export function SiteHeader() {
  const { session, profile, openLogin, signOut } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-8">
        <Link to="/" className="text-xl font-extrabold tracking-tight">
          Geek<span className="text-primary">Verse</span>
        </Link>
        <nav className="hidden gap-1 md:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary">
              {n.label}
            </Link>
          ))}
        </nav>
        <form className="relative ml-auto w-full max-w-xs" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/catalogo", search: { q: q || undefined } }); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dust" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar animes, mangás, novels…" className="h-9 bg-card pl-9" />
        </form>
        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none ring-primary focus-visible:ring-2">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback>{(profile?.username ?? session.user.email ?? "?")[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-semibold">{profile?.username ?? "…"}</div>
                {profile?.role && <div className="font-mono text-xs text-muted-foreground">{roleLabel[profile.role]}</div>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/conta" })}><User className="mr-2 h-4 w-4" />Minha conta</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/conta" })}><Heart className="mr-2 h-4 w-4" />Favoritos</DropdownMenuItem>
              {isStaff(profile?.role) && (
                <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}><Shield className="mr-2 h-4 w-4" />Painel</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" onClick={openLogin}>Entrar</Button>
        )}
      </div>
    </header>
  );
}
