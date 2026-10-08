import { API_URL } from "./config";
import { supabase } from "./supabase";

export type Role = "user" | "moderator" | "content_manager" | "admin";
export type MediaType = "anime" | "manga" | "novel";
export type Language = "sub" | "dub" | "none";

export interface Genre { id: number; name: string }
export interface Content {
  id: number;
  title_id: number;
  title: string;
  season: number;
  episode: number;
  language: Language;
  source_url: string;
  cover_url?: string | undefined;
}
export interface Title {
  id: number;
  name: string;
  synopsis: string;
  cover_url: string;
  banner_url: string;
  type: MediaType;
  age_rating: string;
  status: "releasing" | "completed";
  source?: string;
  publication_year: number;
  episode_count?: number;
  has_sub?: boolean;
  has_dub?: boolean;
  genres?: Genre[];
  contents?: Content[];
}
export interface Author { id: string; username: string; avatar_url?: string | undefined }
export interface Art {
  id: number;
  title: string;
  description: string;
  image_url: string;
  likes_count: number;
  created_at: string;
  author?: Author;
  profile_id?: string;
}
export interface Profile {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string | undefined;
  role?: Role;
  created_at: string;
  arts?: Art[];
}
export interface Favorite { profile_id: string; title_id: number; created_at: string; title: Title }
export interface Paginated<T> { data: T[]; total: number; page: number; limit: number; total_pages: number }

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeader()), ...(init.headers as Record<string, string>) };
  let body = init.body ?? null;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, body });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && String(data.error)) || `Erro ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

function safeJson(t: string) {
  try { return JSON.parse(t); } catch { return t; }
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") s.set(k, String(v)); });
  const str = s.toString();
  return str ? `?${str}` : "";
}

export async function upload(kind: "arts" | "novels", file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await api<{ url: string }>(`/upload/${kind}`, { method: "POST", body: fd });
  return r.url;
}

export const isStaff = (r?: Role) => r === "admin" || r === "content_manager";
export const isModerator = (r?: Role) => r === "admin" || r === "moderator";

export const typeLabel: Record<MediaType, string> = { anime: "Anime", manga: "Mangá", novel: "Novel" };
export const roleLabel: Record<Role, string> = {
  user: "Usuário", moderator: "Moderador", content_manager: "Gerente de Conteúdo", admin: "Administrador",
};
