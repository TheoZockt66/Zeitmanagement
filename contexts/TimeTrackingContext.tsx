"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  CreateEntryPayload,
  CreateFolderPayload,
  CreateModulePayload,
  TimeEntry,
  TimeFolder,
  TimeModule,
  TimeTrackingState,
  UpdateEntryPayload,
} from "../types/time";
import type { ZeitProfile } from "../lib/services/timeTrackingService";
import { useAuth } from "./AuthContext";

type TimeTrackingContextValue = {
  state: TimeTrackingState;
  profile: ZeitProfile | null;
  loading: boolean;
  initialized: boolean;
  isMutating: boolean;
  error: string | null;
  refresh: (options?: { withSpinner?: boolean }) => Promise<void>;
  addFolder: (payload: CreateFolderPayload) => Promise<TimeFolder>;
  updateFolder: (id: string, data: Partial<Omit<TimeFolder, "id" | "order">>) => Promise<TimeFolder>;
  deleteFolder: (id: string) => Promise<void>;
  addModule: (payload: CreateModulePayload) => Promise<TimeModule>;
  updateModule: (id: string, data: Partial<TimeModule>) => Promise<TimeModule>;
  deleteModule: (id: string) => Promise<void>;
  addEntry: (payload: CreateEntryPayload) => Promise<TimeEntry>;
  updateEntry: (id: string, data: UpdateEntryPayload) => Promise<TimeEntry>;
  deleteEntry: (id: string) => Promise<void>;
};

const INITIAL_STATE: TimeTrackingState = {
  folders: [],
  modules: [],
  entries: [],
};

const TimeTrackingContext = createContext<TimeTrackingContextValue | undefined>(undefined);

export function TimeTrackingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isMountedRef = useRef(true);

  const [state, setState] = useState<TimeTrackingState>(INITIAL_STATE);
  const [profile, setProfile] = useState<ZeitProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadState = useCallback(
    async (options: { withSpinner?: boolean } = {}) => {
      const withSpinner = options.withSpinner ?? true;

      if (!user) {
        if (!isMountedRef.current) return;
        setState(INITIAL_STATE);
        setProfile(null);
        setInitialized(false);
        setLoading(false);
        return;
      }

      if (withSpinner && isMountedRef.current) {
        setLoading(true);
      }
      if (isMountedRef.current) {
        setError(null);
      }

      try {
        const response = await fetch("/api/zeit/state", { cache: "no-store" });
        const payload = await handleResponse<{
          profile: ZeitProfile | null;
          folders: TimeFolder[];
          modules: TimeModule[];
          entries: TimeEntry[];
        }>(response, "Zeitdaten konnten nicht geladen werden.");

        if (!isMountedRef.current) return;

        setState({
          folders: payload?.folders ?? [],
          modules: payload?.modules ?? [],
          entries: payload?.entries ?? [],
        });
        setProfile(payload?.profile ?? null);
        setInitialized(true);
      } catch (err) {
        if (!isMountedRef.current) return;
        const message = err instanceof Error ? err.message : "Zeitdaten konnten nicht geladen werden.";
        console.error("[Zeitmanagement] Ladefehler", err);
        setError(message);
        setState(INITIAL_STATE);
        setProfile(null);
        setInitialized(true);
      } finally {
        if (withSpinner && isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      setState(INITIAL_STATE);
      setProfile(null);
      setInitialized(false);
      setLoading(false);
      return;
    }
    loadState({ withSpinner: true }).catch((error) => {
      console.error("[Zeitmanagement] Initialer State-Ladevorgang fehlgeschlagen", error);
    });
  }, [user, loadState]);

  const refresh = useCallback(
    async (options: { withSpinner?: boolean } = {}) => {
      await loadState(options);
    },
    [loadState],
  );

  const addFolder = useCallback(
    async (payload: CreateFolderPayload) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Ordner anzulegen.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch("/api/zeit/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const folder = await handleResponse<TimeFolder>(response, "Ordner konnte nicht erstellt werden.");
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            folders: [...prev.folders, folder],
          }));
        }
        return folder;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ordner konnte nicht erstellt werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user],
  );

  const updateFolder = useCallback(
    async (id: string, data: Partial<Omit<TimeFolder, "id" | "order">>) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Ordner zu bearbeiten.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch(`/api/zeit/folders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const updatedFolder = await handleResponse<TimeFolder>(response, "Ordner konnte nicht aktualisiert werden.");
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            folders: prev.folders.map((folder) => (folder.id === id ? updatedFolder : folder)),
          }));
        }
        return updatedFolder;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ordner konnte nicht aktualisiert werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Ordner zu loeschen.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch(`/api/zeit/folders/${id}`, {
          method: "DELETE",
        });
        await handleResponse<{ success: boolean }>(response, "Ordner konnte nicht geloescht werden.");
        await loadState({ withSpinner: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ordner konnte nicht geloescht werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user, loadState],
  );

  const addModule = useCallback(
    async (payload: CreateModulePayload) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Module anzulegen.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch("/api/zeit/modules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const createdModule = await handleResponse<TimeModule>(response, "Modul konnte nicht erstellt werden.");
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            modules: [...prev.modules, createdModule],
          }));
        }
        return createdModule;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Modul konnte nicht erstellt werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user],
  );

  const updateModule = useCallback(
    async (id: string, data: Partial<TimeModule>) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Module zu bearbeiten.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch(`/api/zeit/modules/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const updatedModule = await handleResponse<TimeModule>(response, "Modul konnte nicht aktualisiert werden.");
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            modules: prev.modules.map((item) => (item.id === id ? updatedModule : item)),
          }));
        }
        return updatedModule;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Modul konnte nicht aktualisiert werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user],
  );

  const deleteModule = useCallback(
    async (id: string) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Module zu loeschen.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch(`/api/zeit/modules/${id}`, {
          method: "DELETE",
        });
        await handleResponse<{ success: boolean }>(response, "Modul konnte nicht geloescht werden.");
        await loadState({ withSpinner: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Modul konnte nicht geloescht werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user, loadState],
  );

  const addEntry = useCallback(
    async (payload: CreateEntryPayload) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Eintraege zu erstellen.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch("/api/zeit/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const entry = await handleResponse<TimeEntry>(response, "Eintrag konnte nicht erstellt werden.");
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            entries: [entry, ...prev.entries],
          }));
        }
        return entry;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Eintrag konnte nicht erstellt werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user],
  );

  const updateEntry = useCallback(
    async (id: string, data: UpdateEntryPayload) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Eintraege zu aktualisieren.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch(`/api/zeit/entries/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const entry = await handleResponse<TimeEntry>(response, "Eintrag konnte nicht aktualisiert werden.");
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            entries: prev.entries.map((item) => (item.id === id ? entry : item)),
          }));
        }
        return entry;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Eintrag konnte nicht aktualisiert werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user) {
        throw new Error("Bitte melde dich an, um Eintraege zu loeschen.");
      }
      setIsMutating(true);
      setError(null);
      try {
        const response = await fetch(`/api/zeit/entries/${id}`, {
          method: "DELETE",
        });
        await handleResponse<{ success: boolean }>(response, "Eintrag konnte nicht geloescht werden.");
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            entries: prev.entries.filter((entry) => entry.id !== id),
          }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Eintrag konnte nicht geloescht werden.";
        if (isMountedRef.current) {
          setError(message);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [user],
  );

  const value = useMemo<TimeTrackingContextValue>(
    () => ({
      state,
      profile,
      loading,
      initialized,
      isMutating,
      error,
      refresh,
      addFolder,
      updateFolder,
      deleteFolder,
      addModule,
      updateModule,
      deleteModule,
      addEntry,
      updateEntry,
      deleteEntry,
    }),
    [
      state,
      profile,
      loading,
      initialized,
      isMutating,
      error,
      refresh,
      addFolder,
      updateFolder,
      deleteFolder,
      addModule,
      updateModule,
      deleteModule,
      addEntry,
      updateEntry,
      deleteEntry,
    ],
  );

  return <TimeTrackingContext.Provider value={value}>{children}</TimeTrackingContext.Provider>;
}

export function useTimeTrackingContext() {
  const context = useContext(TimeTrackingContext);
  if (!context) {
    throw new Error("TimeTrackingContext muss innerhalb des TimeTrackingProvider verwendet werden");
  }
  return context;
}

async function handleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let payload: unknown = null;
  try {
    if (response.status !== 204) {
      payload = await response.json();
    }
  } catch {
    payload = null;
  }

  const payloadObject = (payload as Record<string, unknown>) ?? null;

  if (!response.ok) {
    const message = payload?.error ?? fallbackMessage;
    throw new Error(message);
  }

  if (payload === null || payload === undefined) {
    return undefined as T;
  }

  if (payloadObject && "data" in payloadObject) {
    return payloadObject.data as T;
  }

  return payload as T;
}










