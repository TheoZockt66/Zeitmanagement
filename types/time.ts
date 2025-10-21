export type TimeFolder = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
};

export type TimeModule = {
  id: string;
  name: string;
  folderId: string;
  targetHours?: number;
  notes?: string;
  order: number;
};

export type TimeEntry = {
  id: string;
  moduleId: string;
  activityType: string;
  description?: string;
  durationHours: number;
  timestamp: string;
  createdAt: string;
};

export type TimeTrackingState = {
  folders: TimeFolder[];
  modules: TimeModule[];
  entries: TimeEntry[];
};

export type CreateEntryPayload = Omit<TimeEntry, 'id' | 'createdAt'>;

export type UpdateEntryPayload = Partial<Omit<TimeEntry, 'id' | 'createdAt'>>;

export type CreateFolderPayload = { name: string; parentId: string | null };

export type CreateModulePayload = Omit<TimeModule, 'id' | 'order'>;
