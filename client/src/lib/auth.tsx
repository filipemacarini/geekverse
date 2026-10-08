import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { api, type Profile } from "./api";

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  loginOpen: boolean;
  openLogin: () => void;
  setLoginOpen: (v: boolean) => void;
  /** Runs fn if logged in, otherwise opens the login modal. */
  requireAuth: (fn: () => void) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        qc.invalidateQueries({ queryKey: ["me"] });
        qc.invalidateQueries({ queryKey: ["favorites"] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  const me = useQuery({
    queryKey: ["me", session?.user.id],
    queryFn: () => api<Profile>("/profiles/me"),
    enabled: !!session,
    retry: 1,
  });

  const requireAuth = useCallback((fn: () => void) => {
    if (session) fn(); else setLoginOpen(true);
  }, [session]);

  const signOut = async () => {
    await qc.cancelQueries();
    await supabase.auth.signOut();
    qc.removeQueries({ queryKey: ["me"] });
    qc.removeQueries({ queryKey: ["favorites"] });
  };

  return (
    <Ctx.Provider value={{
      session,
      profile: session ? me.data ?? null : null,
      loading: !ready || (!!session && me.isLoading),
      loginOpen, setLoginOpen, openLogin: () => setLoginOpen(true), requireAuth, signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
