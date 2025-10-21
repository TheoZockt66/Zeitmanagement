import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function ensureEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase ist nicht konfiguriert. Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY definieren.",
    );
  }
}

export async function getServerSupabaseClient(): Promise<SupabaseClient> {
  ensureEnv();

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        const value = cookieStore.get(name)?.value;
        return value;
      },
      set(name: string, value: string, options: CookieOptions = {}) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions = {}) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });
}
