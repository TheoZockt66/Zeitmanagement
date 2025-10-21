import { createBrowserClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasEnv = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

if (!hasEnv) {
  console.warn(
    "[Zeitmanagement] Supabase Browser Client wurde ohne vollstaendige NEXT_PUBLIC_SUPABASE_* Variablen initialisiert. Auth Features sind deaktiviert.",
  );
}

let cachedClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Supabase ist nicht konfiguriert. Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY setzen.",
      );
    }

    cachedClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          if (typeof document === "undefined") return undefined;
          return readCookie(name)?.value;
        },
        set(name, value, options) {
          if (typeof document === "undefined") return;
          document.cookie = serializeCookie(name, value, options);
        },
        remove(name, options) {
          if (typeof document === "undefined") return;
          document.cookie = serializeCookie(name, "", { ...(options ?? {}), maxAge: 0 });
        },
      },
    });
  }
  return cachedClient;
}

function readCookie(name: string): { name: string; value: string } | undefined {
  if (typeof document === "undefined" || !document.cookie) return undefined;
  const cookies = document.cookie.split("; ");
  for (const entry of cookies) {
    if (!entry) continue;
    const [cookieName, ...rest] = entry.split("=");
    if (cookieName === name) {
      return { name: cookieName, value: rest.join("=") };
    }
  }
  return undefined;
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${value}`];
  parts.push(`path=${options.path ?? "/"}`);

  if (options.domain) {
    parts.push(`domain=${options.domain}`);
  }
  if (options.maxAge !== undefined) {
    parts.push(`max-age=${options.maxAge}`);
  }
  if (options.expires) {
    const expires =
      typeof options.expires === "string"
        ? new Date(options.expires)
        : options.expires instanceof Date
          ? options.expires
          : null;
    if (expires) {
      parts.push(`expires=${expires.toUTCString()}`);
    }
  }
  if (options.sameSite) {
    parts.push(`samesite=${String(options.sameSite).toLowerCase()}`);
  }
  if (options.secure) {
    parts.push("secure");
  }
  if (options.httpOnly) {
    parts.push("httponly");
  }

  return parts.join("; ");
}

