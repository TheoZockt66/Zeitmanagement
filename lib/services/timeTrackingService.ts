import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ZEIT_TABLES, ZEIT_RPCS, ZEIT_VIEWS } from "../supabase/constants";
import { getServerSupabaseClient } from "../supabase/server";
import type {
  CreateEntryPayload,
  CreateFolderPayload,
  CreateModulePayload,
  TimeEntry,
  TimeFolder,
  TimeModule,
  UpdateEntryPayload,
} from "../../types/time";

type ZeitProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  timezone: string | null;
  default_view: string | null;
  weekly_focus_goal_minutes: number | null;
  default_entry_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
};

type ZeitFolderRow = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  order_index: number;
  color: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type ZeitModuleRow = {
  id: string;
  user_id: string;
  folder_id: string;
  name: string;
  target_hours: number | null;
  notes: string | null;
  color: string | null;
  order_index: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type ZeitEntryRow = {
  id: string;
  user_id: string;
  module_id: string;
  activity_type: string;
  description: string | null;
  duration_minutes: number;
  entry_date: string;
  started_at: string | null;
  created_at: string;
  updated_at: string;
};

type ZeitTimerSessionRow = {
  id: string;
  user_id: string;
  module_id: string | null;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  created_at: string;
};

type ZeitModuleStatsRow = {
  module_id: string;
  user_id: string;
  total_duration_minutes: number;
  entry_count: number;
  first_entry_date: string | null;
  last_entry_date: string | null;
};

type ZeitFullStatePayload = {
  profile: ZeitProfileRow | null;
  folders: ZeitFolderRow[];
  modules: ZeitModuleRow[];
  entries: ZeitEntryRow[];
};

export type ZeitProfile = {
  userId: string;
  email: string | null;
  displayName: string | null;
  timezone: string;
  weeklyFocusGoalMinutes: number;
  defaultEntryDurationMinutes: number;
  defaultView: string;
  updatedAt: string;
};

export type ZeitManagementState = {
  profile: ZeitProfile | null;
  folders: TimeFolder[];
  modules: TimeModule[];
  entries: TimeEntry[];
};

type FolderUpdateInput = Partial<{
  name: string;
  parentId: string | null;
  order: number;
}>;

type ModuleUpdateInput = Partial<{
  name: string;
  folderId: string;
  targetHours: number | null;
  notes: string | null;
  order: number;
}>;

type EntryUpdateInput = UpdateEntryPayload;

function minutesToHours(minutes: number) {
  return Math.round(minutes) / 60;
}

function hoursToMinutes(hours: number) {
  return Math.round(hours * 60);
}

export class TimeTrackingService {
  private constructor(private readonly supabase: SupabaseClient, private readonly user: User) {}

  static async fromRequest() {
    const supabase = await getServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      throw new Error(`Authentifizierung fehlgeschlagen: ${error.message}`);
    }
    if (!user) {
      throw new Error("Unautorisiert: Kein angemeldeter Benutzer gefunden.");
    }
    return new TimeTrackingService(supabase, user);
  }

  async fetchState(): Promise<ZeitManagementState> {
    const { data, error } = await this.supabase.rpc(ZEIT_RPCS.GET_FULL_STATE);
    if (error) {
      throw new Error(`Zeitdaten konnten nicht geladen werden: ${error.message}`);
    }

    const payload = (data as ZeitFullStatePayload | null) ?? null;

    const profile = payload?.profile ? mapProfileRow(payload.profile) : null;
    const folders = (payload?.folders ?? []).map(mapFolderRow);
    const modules = (payload?.modules ?? []).map(mapModuleRow);
    const entries = (payload?.entries ?? []).map(mapEntryRow);

    return { profile, folders, modules, entries };
  }

  async fetchModuleStats(): Promise<ZeitModuleStatsRow[]> {
    const { data, error } = await this.supabase
      .from(ZEIT_VIEWS.MODULE_STATS)
      .select("*")
      .eq("user_id", this.user.id);

    if (error) {
      throw new Error(`Modulstatistiken konnten nicht geladen werden: ${error.message}`);
    }
    return (data as ZeitModuleStatsRow[] | null) ?? [];
  }

  async upsertProfile(profile: Partial<ZeitProfile>): Promise<ZeitProfile> {
    const row = {
      user_id: this.user.id,
      email: profile.email ?? undefined,
      display_name: profile.displayName ?? undefined,
      timezone: profile.timezone ?? undefined,
      weekly_focus_goal_minutes: profile.weeklyFocusGoalMinutes ?? undefined,
      default_entry_duration_minutes: profile.defaultEntryDurationMinutes ?? undefined,
      default_view: profile.defaultView ?? undefined,
    };

    const { data, error } = await this.supabase
      .from(ZEIT_TABLES.PROFILES)
      .upsert(row, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      throw new Error(`Profil konnte nicht gespeichert werden: ${error.message}`);
    }

    const profileRow = data as ZeitProfileRow | null;
    if (!profileRow) {
      throw new Error("Profil konnte nicht gespeichert werden: Leere Antwort erhalten.");
    }

    return mapProfileRow(profileRow);
  }

  async createFolder(payload: CreateFolderPayload): Promise<TimeFolder> {
    const orderIndex = await this.computeNextFolderOrder(payload.parentId);

    const { data, error } = await this.supabase
      .from(ZEIT_TABLES.FOLDERS)
      .insert({
        user_id: this.user.id,
        name: payload.name,
        parent_id: payload.parentId,
        order_index: orderIndex,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Ordner konnte nicht erstellt werden: ${error.message}`);
    }
    const folderRow = data as ZeitFolderRow | null;
    if (!folderRow) {
      throw new Error("Ordner konnte nicht erstellt werden: Leere Antwort erhalten.");
    }
    return mapFolderRow(folderRow);
  }

  async updateFolder(id: string, data: FolderUpdateInput): Promise<TimeFolder> {
    const update: Partial<ZeitFolderRow> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.parentId !== undefined) update.parent_id = data.parentId;
    if (data.order !== undefined) update.order_index = data.order;

    const { data: updated, error } = await this.supabase
      .from(ZEIT_TABLES.FOLDERS)
      .update(update)
      .eq("id", id)
      .eq("user_id", this.user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Ordner konnte nicht aktualisiert werden: ${error.message}`);
    }

    const folderRow = updated as ZeitFolderRow | null;
    if (!folderRow) {
      throw new Error("Ordner konnte nicht aktualisiert werden: Leere Antwort erhalten.");
    }

    return mapFolderRow(folderRow);
  }

  async deleteFolder(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(ZEIT_TABLES.FOLDERS)
      .delete()
      .eq("id", id)
      .eq("user_id", this.user.id);

    if (error) {
      throw new Error(`Ordner konnte nicht geloescht werden: ${error.message}`);
    }
  }

  async createModule(payload: CreateModulePayload): Promise<TimeModule> {
    const orderIndex = await this.computeNextModuleOrder(payload.folderId);

    const { data, error } = await this.supabase
      .from(ZEIT_TABLES.MODULES)
      .insert({
        user_id: this.user.id,
        folder_id: payload.folderId,
        name: payload.name,
        target_hours: payload.targetHours ?? null,
        notes: payload.notes ?? null,
        order_index: orderIndex,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Modul konnte nicht erstellt werden: ${error.message}`);
    }
    const moduleRow = data as ZeitModuleRow | null;
    if (!moduleRow) {
      throw new Error("Modul konnte nicht erstellt werden: Leere Antwort erhalten.");
    }
    return mapModuleRow(moduleRow);
  }

  async updateModule(id: string, data: ModuleUpdateInput): Promise<TimeModule> {
    const update: Partial<ZeitModuleRow> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.folderId !== undefined) update.folder_id = data.folderId;
    if (data.targetHours !== undefined) update.target_hours = data.targetHours;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.order !== undefined) update.order_index = data.order;

    const { data: updated, error } = await this.supabase
      .from(ZEIT_TABLES.MODULES)
      .update(update)
      .eq("id", id)
      .eq("user_id", this.user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Modul konnte nicht aktualisiert werden: ${error.message}`);
    }

    const moduleRow = updated as ZeitModuleRow | null;
    if (!moduleRow) {
      throw new Error("Modul konnte nicht aktualisiert werden: Leere Antwort erhalten.");
    }

    return mapModuleRow(moduleRow);
  }

  async deleteModule(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(ZEIT_TABLES.MODULES)
      .delete()
      .eq("id", id)
      .eq("user_id", this.user.id);

    if (error) {
      throw new Error(`Modul konnte nicht geloescht werden: ${error.message}`);
    }
  }

  async createEntry(payload: CreateEntryPayload): Promise<TimeEntry> {
    const durationMinutes = hoursToMinutes(payload.durationHours);

    const { data, error } = await this.supabase
      .from(ZEIT_TABLES.ENTRIES)
      .insert({
        user_id: this.user.id,
        module_id: payload.moduleId,
        activity_type: payload.activityType,
        description: payload.description ?? null,
        duration_minutes: durationMinutes,
        entry_date: payload.timestamp,
        started_at: null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Zeiteintrag konnte nicht erstellt werden: ${error.message}`);
    }

    const entryRow = data as ZeitEntryRow | null;
    if (!entryRow) {
      throw new Error("Zeiteintrag konnte nicht erstellt werden: Leere Antwort erhalten.");
    }

    return mapEntryRow(entryRow);
  }

  async updateEntry(id: string, payload: EntryUpdateInput): Promise<TimeEntry> {
    const update: Partial<ZeitEntryRow> = {};
    if (payload.activityType !== undefined) update.activity_type = payload.activityType;
    if (payload.description !== undefined) update.description = payload.description ?? null;
    if (payload.durationHours !== undefined) update.duration_minutes = hoursToMinutes(payload.durationHours);
    if (payload.moduleId !== undefined) update.module_id = payload.moduleId;
    if (payload.timestamp !== undefined) {
      update.entry_date = payload.timestamp;
    }

    const { data, error } = await this.supabase
      .from(ZEIT_TABLES.ENTRIES)
      .update(update)
      .eq("id", id)
      .eq("user_id", this.user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Zeiteintrag konnte nicht aktualisiert werden: ${error.message}`);
    }

    const entryRow = data as ZeitEntryRow | null;
    if (!entryRow) {
      throw new Error("Zeiteintrag konnte nicht aktualisiert werden: Leere Antwort erhalten.");
    }

    return mapEntryRow(entryRow);
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(ZEIT_TABLES.ENTRIES)
      .delete()
      .eq("id", id)
      .eq("user_id", this.user.id);

    if (error) {
      throw new Error(`Zeiteintrag konnte nicht geloescht werden: ${error.message}`);
    }
  }

  async createTimerSession(entry: {
    moduleId?: string | null;
    startedAt: string;
    stoppedAt?: string | null;
    durationSeconds?: number | null;
    note?: string | null;
  }): Promise<ZeitTimerSessionRow> {
    const { data, error } = await this.supabase
      .from(ZEIT_TABLES.TIMER_SESSIONS)
      .insert({
        user_id: this.user.id,
        module_id: entry.moduleId ?? null,
        started_at: entry.startedAt,
        stopped_at: entry.stoppedAt ?? null,
        duration_seconds: entry.durationSeconds ?? null,
        note: entry.note ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Timer-Session konnte nicht gespeichert werden: ${error.message}`);
    }
    const timerRow = data as ZeitTimerSessionRow | null;
    if (!timerRow) {
      throw new Error("Timer-Session konnte nicht gespeichert werden: Leere Antwort erhalten.");
    }
    return timerRow;
  }

  private async computeNextFolderOrder(parentId: string | null): Promise<number> {
    let query = this.supabase
      .from(ZEIT_TABLES.FOLDERS)
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.user.id);
    query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId);
    const { count, error } = await query;
    if (error) {
      throw new Error(`Reihenfolge für Ordner konnte nicht berechnet werden: ${error.message}`);
    }
    return count ?? 0;
  }

  private async computeNextModuleOrder(folderId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(ZEIT_TABLES.MODULES)
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.user.id)
      .eq("folder_id", folderId);

    if (error) {
      throw new Error(`Reihenfolge für Module konnte nicht berechnet werden: ${error.message}`);
    }
    return count ?? 0;
  }
}

function mapProfileRow(row: ZeitProfileRow): ZeitProfile {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    timezone: row.timezone ?? "Europe/Berlin",
    weeklyFocusGoalMinutes: row.weekly_focus_goal_minutes ?? 1500,
    defaultEntryDurationMinutes: row.default_entry_duration_minutes ?? 60,
    defaultView: row.default_view ?? "dashboard",
    updatedAt: row.updated_at,
  };
}

function mapFolderRow(row: ZeitFolderRow): TimeFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    order: row.order_index,
  };
}

function mapModuleRow(row: ZeitModuleRow): TimeModule {
  return {
    id: row.id,
    name: row.name,
    folderId: row.folder_id,
    targetHours: row.target_hours ?? undefined,
    notes: row.notes ?? undefined,
    order: row.order_index,
  };
}

function mapEntryRow(row: ZeitEntryRow): TimeEntry {
  return {
    id: row.id,
    moduleId: row.module_id,
    activityType: row.activity_type,
    description: row.description ?? undefined,
    durationHours: minutesToHours(row.duration_minutes),
    timestamp: row.entry_date,
    createdAt: row.created_at,
  };
}


