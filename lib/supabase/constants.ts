export const ZEIT_TABLES = {
  PROFILES: "zeit_profiles",
  FOLDERS: "zeit_folders",
  MODULES: "zeit_modules",
  ENTRIES: "zeit_entries",
  TIMER_SESSIONS: "zeit_timer_sessions",
} as const;

export const ZEIT_VIEWS = {
  MODULE_STATS: "zeit_module_stats",
} as const;

export const ZEIT_RPCS = {
  GET_FULL_STATE: "zeit_get_full_state",
} as const;

export type ZeitTables = typeof ZEIT_TABLES[keyof typeof ZEIT_TABLES];
