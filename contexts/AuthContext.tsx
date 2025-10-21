"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { notifications } from "@mantine/notifications";
import { getBrowserSupabaseClient } from "../lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => {
    try {
      return getBrowserSupabaseClient();
    } catch (error) {
      console.error("[Zeitmanagement] Supabase Client konnte nicht initialisiert werden", error);
      throw error;
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        console.error("[Zeitmanagement] Session konnte nicht geladen werden", error);
        setUser(null);
        setSession(null);
      } else {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
      setInitialized(true);
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        notifications.show({
          title: "Anmeldung fehlgeschlagen",
          message: error.message,
          color: "red",
        });
      }
      return { error };
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: displayName ? { display_name: displayName } : undefined,
        },
      });

      if (error) {
        notifications.show({
          title: "Registrierung fehlgeschlagen",
          message: error.message,
          color: "red",
        });
      } else if (!data.session) {
        notifications.show({
          title: "Bestaetigung erforderlich",
          message: "Bitte bestaetige deine E-Mail ueber den zugesandten Link.",
          color: "blue",
        });
      }

      return { error };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      notifications.show({
        title: "Abmeldung fehlgeschlagen",
        message: error.message,
        color: "red",
      });
    } else {
      notifications.show({
        title: "Abgemeldet",
        message: "Du wurdest erfolgreich abgemeldet.",
        color: "green",
      });
    }
  }, [supabase]);

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[Zeitmanagement] Session-Refresh fehlgeschlagen", error);
      return;
    }
    setSession(data.session);
    setUser(data.session?.user ?? null);
  }, [supabase]);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    initialized,
    signIn,
    signUp,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth muss innerhalb des AuthProvider verwendet werden");
  }
  return context;
}


