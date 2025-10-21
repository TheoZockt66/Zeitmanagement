import { useMemo } from "react";
import { useTimeTrackingContext } from "../contexts/TimeTrackingContext";
import type { TimeEntry, TimeFolder, TimeModule } from "../types/time";

export type ModuleWithRelations = TimeModule & {
  folder: TimeFolder;
  entries: TimeEntry[];
  totalHours: number;
};

export type FolderNode = TimeFolder & {
  children: FolderNode[];
  modules: ModuleWithRelations[];
  totalHours: number;
};

export type FlattenedFolder = {
  id: string;
  path: string;
  depth: number;
  parentId: string | null;
};

export function useTimeTracking() {
  const context = useTimeTrackingContext();
  const { state } = context;

  const entriesSorted = useMemo(
    () =>
      [...state.entries].sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0)),
    [state.entries],
  );

  const folderMap = useMemo(() => {
    const map = new Map<string, TimeFolder>();
    state.folders.forEach((folder) => map.set(folder.id, folder));
    return map;
  }, [state.folders]);

  const moduleMap = useMemo(() => {
    const map = new Map<string, TimeModule>();
    state.modules.forEach((module) => map.set(module.id, module));
    return map;
  }, [state.modules]);

  const modulesWithRelations = useMemo<ModuleWithRelations[]>(() => {
    return state.modules.map((module) => {
      const folder = folderMap.get(module.folderId);
      if (!folder) {
        throw new Error(`Ordner mit ID ${module.folderId} nicht gefunden`);
      }
      const entries = entriesSorted.filter((entry) => entry.moduleId === module.id);
      const totalHours = entries.reduce((sum, entry) => sum + entry.durationHours, 0);
      return {
        ...module,
        folder,
        entries,
        totalHours,
      };
    });
  }, [state.modules, folderMap, entriesSorted]);

  const modulesByFolderId = useMemo(() => {
    const map = new Map<string, ModuleWithRelations[]>();
    modulesWithRelations.forEach((module) => {
      const list = map.get(module.folderId) ?? [];
      list.push(module);
      map.set(module.folderId, list);
    });
    state.folders.forEach((folder) => {
      const list = map.get(folder.id);
      if (list) {
        list.sort((a, b) => a.order - b.order);
      }
    });
    return map;
  }, [modulesWithRelations, state.folders]);

  const buildFolderTree = useMemo(() => {
    const build = (parentId: string | null): FolderNode[] => {
      return state.folders
        .filter((folder) => folder.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map((folder) => {
          const children = build(folder.id);
          const modules = modulesByFolderId.get(folder.id) ?? [];
          const modulesHours = modules.reduce((sum, module) => sum + module.totalHours, 0);
          const childrenHours = children.reduce((sum, child) => sum + child.totalHours, 0);
          return {
            ...folder,
            children,
            modules,
            totalHours: modulesHours + childrenHours,
          };
        });
    };
    return build(null);
  }, [state.folders, modulesByFolderId]);

  const flattenedFolders = useMemo<FlattenedFolder[]>(() => {
    const result: FlattenedFolder[] = [];
    const traverse = (nodes: FolderNode[], parentPath: string, depth: number) => {
      nodes.forEach((node) => {
        const path = parentPath ? `${parentPath} / ${node.name}` : node.name;
        result.push({ id: node.id, path, depth, parentId: node.parentId });
        traverse(node.children, path, depth + 1);
      });
    };
    traverse(buildFolderTree, "", 0);
    return result;
  }, [buildFolderTree]);

  const folderDescendantsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const computeDescendants = (node: FolderNode): Set<string> => {
      const set = new Set<string>([node.id]);
      node.children.forEach((child) => {
        const childSet = computeDescendants(child);
        childSet.forEach((id) => set.add(id));
      });
      map.set(node.id, set);
      return set;
    };
    buildFolderTree.forEach((node) => computeDescendants(node));
    return map;
  }, [buildFolderTree]);

  const totalTrackedHours = useMemo(
    () => state.entries.reduce((sum, entry) => sum + entry.durationHours, 0),
    [state.entries],
  );

  return {
    ...context,
    entriesSorted,
    modulesWithRelations,
    folderTree: buildFolderTree,
    flattenedFolders,
    folderDescendantsMap,
    totalTrackedHours,
    getFolderById: (id: string) => folderMap.get(id) ?? null,
    getModuleById: (id: string) => moduleMap.get(id) ?? null,
  };
}
