"use client";

import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconChevronDown,
  IconChevronRight,
  IconFolderMinus,
  IconFolderPlus,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTimeTracking, FolderNode } from "../../hooks/useTimeTracking";
import { notifications } from "@mantine/notifications";

type FolderFormState = {
  name: string;
  parentId: string | null;
};

type ModuleFormState = {
  folderId: string;
  name: string;
  targetHours?: number;
  notes?: string;
};

type DeleteTarget = {
  type: "folder" | "module";
  id: string;
  name: string;
  description: string;
};

const EMPTY_FOLDER_FORM: FolderFormState = { name: "", parentId: null };
const EMPTY_MODULE_FORM: ModuleFormState = { folderId: "", name: "", targetHours: undefined, notes: "" };

export default function StructurePageContent() {
  const {
    folderTree,
    flattenedFolders,
    loading: stateLoading,
    initialized,
    error,
    isMutating,
    refresh,
    addFolder,
    updateFolder,
    deleteFolder,
    addModule,
    updateModule,
    deleteModule,
  } = useTimeTracking();

  const [folderModalOpened, { open: openFolderModal, close: closeFolderModal }] = useDisclosure(false);
  const [moduleModalOpened, { open: openModuleModal, close: closeModuleModal }] = useDisclosure(false);

  const [folderForm, setFolderForm] = useState<FolderFormState>(EMPTY_FOLDER_FORM);
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(EMPTY_MODULE_FORM);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [folderSubmitting, setFolderSubmitting] = useState(false);
  const [moduleSubmitting, setModuleSubmitting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const mutationBusy = isMutating || folderSubmitting || moduleSubmitting || deleteLoading;
  const isMobile = useMediaQuery("(max-width: 48em)");

  const folderOptions = useMemo(
    () =>
      flattenedFolders.map((folder) => ({
        label: folder.path,
        value: folder.id,
      })),
    [flattenedFolders],
  );

  const modulesLookup = useMemo(() => {
    const map = new Map<string, ReturnType<typeof collectModules>[number]>();
    folderTree.forEach((node) => {
      collectModules(node).forEach((mod) => map.set(mod.id, mod));
    });
    return map;
  }, [folderTree]);

  const initialLoading = stateLoading && !initialized;

  if (initialLoading) {
    return (
      <Center mih="70vh">
        <Loader size="lg" />
      </Center>
    );
  }

  const openCreateFolderModal = (parentId: string | null) => {
    setEditingFolderId(null);
    setFolderForm({ name: "", parentId });
    openFolderModal();
  };

  const openEditFolderModal = (folderId: string) => {
    const folder = flattenedFolders.find((item) => item.id === folderId);
    if (!folder) return;
    const folderSegments = folder.path.split(" / ");
    const name = folderSegments[folderSegments.length - 1] ?? folder.path;
    setEditingFolderId(folderId);
    setFolderForm({ name, parentId: folder.parentId });
    openFolderModal();
  };

  const openCreateModuleModal = (folderId: string) => {
    setEditingModuleId(null);
    setModuleForm({ folderId, name: "", targetHours: undefined, notes: "" });
    openModuleModal();
  };

  const openEditModuleModal = (moduleId: string) => {
    const mod = modulesLookup.get(moduleId);
    if (!mod) return;
    setEditingModuleId(moduleId);
    setModuleForm({
      folderId: mod.folder.id,
      name: mod.name,
      targetHours: mod.targetHours,
      notes: mod.notes,
    });
    openModuleModal();
  };

  const handleSaveFolder = async () => {
    const trimmedName = folderForm.name.trim();
    if (!trimmedName) return;

    const payload = {
      name: trimmedName,
      parentId: folderForm.parentId,
    };

    setFolderSubmitting(true);
    try {
      if (editingFolderId) {
        await updateFolder(editingFolderId, payload);
        notifications.show({
          title: "Ordner aktualisiert",
          message: `"${trimmedName}" wurde aktualisiert.`,
          color: "green",
        });
      } else {
        await addFolder(payload);
        notifications.show({
          title: "Ordner erstellt",
          message: `"${trimmedName}" wurde angelegt.`,
          color: "green",
        });
      }
      setFolderForm(EMPTY_FOLDER_FORM);
      setEditingFolderId(null);
      closeFolderModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ordner konnte nicht gespeichert werden.";
      notifications.show({
        title: "Fehler",
        message,
        color: "red",
      });
    } finally {
      setFolderSubmitting(false);
    }
  };

  const handleSaveModule = async () => {
    const trimmedName = moduleForm.name.trim();
    if (!trimmedName || !moduleForm.folderId) return;

    const sanitizedNotes = moduleForm.notes?.trim();
    const creationPayload: CreateModulePayload = {
      folderId: moduleForm.folderId,
      name: trimmedName,
      targetHours: moduleForm.targetHours ?? undefined,
      notes: sanitizedNotes ? sanitizedNotes : undefined,
    };

    const updatePayload: Partial<TimeModule> = {
      folderId: moduleForm.folderId,
      name: trimmedName,
      targetHours: moduleForm.targetHours ?? undefined,
      notes: sanitizedNotes ? sanitizedNotes : undefined,
    };

    setModuleSubmitting(true);
    try {
      if (editingModuleId) {
        await updateModule(editingModuleId, updatePayload);
        notifications.show({
          title: "Projekt aktualisiert",
          message: `"${trimmedName}" wurde aktualisiert.`,
          color: "green",
        });
      } else {
        await addModule(creationPayload);
        notifications.show({
          title: "Projekt erstellt",
          message: `"${trimmedName}" wurde angelegt.`,
          color: "green",
        });
      }
      setModuleForm({ ...EMPTY_MODULE_FORM, folderId: moduleForm.folderId });
      setEditingModuleId(null);
      closeModuleModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Projekt konnte nicht gespeichert werden.";
      notifications.show({
        title: "Fehler",
        message,
        color: "red",
      });
    } finally {
      setModuleSubmitting(false);
    }
  };

  const requestDeleteFolder = (folderId: string) => {
    const folderPath = flattenedFolders.find((item) => item.id === folderId)?.path ?? "diesen Ordner";
    setDeleteTarget({
      type: "folder",
      id: folderId,
      name: folderPath,
      description: "Alle Unterordner und Projekte werden ebenfalls gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden.",
    });
  };

  const requestDeleteModule = (moduleId: string) => {
    const moduleEntry = modulesLookup.get(moduleId);
    const moduleName = moduleEntry?.name ?? "dieses Projekt";
    setDeleteTarget({
      type: "module",
      id: moduleId,
      name: moduleName,
      description: "Alle erfassten Zeiten für dieses Projekt gehen verloren. Dieser Schritt kann nicht rückgängig gemacht werden.",
    });
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === "folder") {
        await deleteFolder(deleteTarget.id);
        notifications.show({
          title: "Ordner gelöscht",
          message: `"${deleteTarget.name}" wurde entfernt.`,
          color: "green",
        });
      } else {
        await deleteModule(deleteTarget.id);
        notifications.show({
          title: "Projekt gelöscht",
          message: `"${deleteTarget.name}" wurde entfernt.`,
          color: "green",
        });
      }
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Element konnte nicht gelöscht werden.";
      notifications.show({
        title: "Fehler",
        message,
        color: "red",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const canCreateModule = folderTree.length > 0 || flattenedFolders.length > 0;
  const defaultFolderId = flattenedFolders[0]?.id ?? folderTree[0]?.id ?? "";

  return (
    <>
      <Stack gap="lg">
        {error ? (
          <Alert
            color="red"
            variant="light"
            title="Synchronisationsfehler"
            withCloseButton={false}
          >
            <Group justify="space-between" align="center">
              <Text fw={500}>{error}</Text>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  refresh({ withSpinner: true }).catch((err) => {
                    console.error("[Zeitmanagement] Manuelles Refresh fehlgeschlagen", err);
                  });
                }}
                loading={stateLoading}
              >
                Erneut laden
              </Button>
            </Group>
          </Alert>
        ) : null}

        <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
          <Stack gap={4}>
            <Title order={2}>Ordner & Projekte</Title>
            <Text c="dimmed">
              Verschachtelte Ordnerstruktur mit Projekten. Ordner lassen sich einklappen, bearbeiten oder löschen.
            </Text>
          </Stack>
          <Group
            gap="sm"
            wrap="wrap"
            justify="flex-end"
            style={{ flex: isMobile ? "1 1 100%" : "0 0 auto" }}
          >
            <Button
              leftSection={<IconFolderPlus size={18} />}
              variant="light"
              onClick={() => openCreateFolderModal(null)}
              disabled={mutationBusy}
              fullWidth={isMobile}
            >
              Neuer Ordner
            </Button>
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={() => openCreateModuleModal(defaultFolderId)}
              disabled={!canCreateModule || mutationBusy}
              fullWidth={isMobile}
            >
              Neues Projekt
            </Button>
          </Group>
        </Group>

        <Stack gap="md">
          {folderTree.map((folder) => (
            <FolderCard
              key={folder.id}
              node={folder}
              depth={0}
              collapsedFolders={collapsedFolders}
              onToggleCollapse={toggleCollapse}
              onAddFolder={openCreateFolderModal}
              onEditFolder={openEditFolderModal}
              onDeleteFolder={requestDeleteFolder}
              onAddModule={openCreateModuleModal}
              onEditModule={openEditModuleModal}
              onDeleteModule={requestDeleteModule}
              disabled={mutationBusy}
            />
          ))}
          {folderTree.length === 0 ? (
            <Card padding="xl" radius="md">
              <Stack align="center" gap="sm">
                <Text fw={600}>Noch keine Ordner angelegt</Text>
                <Text c="dimmed" ta="center">
                  Lege deinen ersten Ordner an, um Projekte zu strukturieren.
                </Text>
                <Button leftSection={<IconFolderPlus size={18} />} onClick={() => openCreateFolderModal(null)}>
                  Ordner erstellen
                </Button>
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Stack>

      <Modal
        opened={folderModalOpened}
        onClose={() => {
          if (folderSubmitting) return;
          closeFolderModal();
          setEditingFolderId(null);
          setFolderForm(EMPTY_FOLDER_FORM);
        }}
        title={editingFolderId ? "Ordner bearbeiten" : "Neuer Ordner"}
        radius="lg"
        fullScreen={isMobile}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            value={folderForm.name}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFolderForm((prev) => ({ ...prev, name: value }));
            }}
            placeholder="z. B. Studium"
            required
            disabled={folderSubmitting}
          />
          <Select
            label="Uebergeordneter Ordner"
            placeholder="Kein (Top-Level)"
            data={folderOptions}
            value={folderForm.parentId ?? ""}
            onChange={(value) => {
              setFolderForm((prev) => ({ ...prev, parentId: value && value.length > 0 ? value : null }));
            }}
            clearable
            disabled={folderSubmitting}
          />
          <Button onClick={handleSaveFolder} loading={folderSubmitting} disabled={folderSubmitting}>{editingFolderId ? "Aktualisieren" : "Speichern"}</Button>
        </Stack>
      </Modal>

      <Modal
        opened={moduleModalOpened}
        onClose={() => {
          if (moduleSubmitting) return;
          closeModuleModal();
          setEditingModuleId(null);
          setModuleForm(EMPTY_MODULE_FORM);
        }}
        title={editingModuleId ? "Projekt bearbeiten" : "Neues Projekt"}
        radius="lg"
        size={isMobile ? "md" : "lg"}
        fullScreen={isMobile}
        centered
      >
        <Stack gap="md">
          <Select
            label="Ordner"
            data={folderOptions}
            value={moduleForm.folderId}
            onChange={(value) => {
              setModuleForm((prev) => ({ ...prev, folderId: value ?? "" }));
            }}
            searchable
            disabled={moduleSubmitting}
            required
          />
          <TextInput
            label="Projektname"
            value={moduleForm.name}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setModuleForm((prev) => ({ ...prev, name: value }));
            }}
            required
            placeholder="z. B. Projektmanagement"
            disabled={moduleSubmitting}
          />
          <NumberInput
            label="Zielzeit (h)"
            value={moduleForm.targetHours}
            onChange={(value) => setModuleForm((prev) => ({ ...prev, targetHours: Number(value) || undefined }))}
            min={0}
            step={1}
            disabled={moduleSubmitting}
          />
          <Textarea
            label="Notizen"
            value={moduleForm.notes}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setModuleForm((prev) => ({ ...prev, notes: value }));
            }}
            minRows={3}
            disabled={moduleSubmitting}
          />
          <Button onClick={handleSaveModule}>{editingModuleId ? "Aktualisieren" : "Speichern"}</Button>
        </Stack>
      </Modal>

      <Modal opened={deleteTarget !== null} onClose={closeDeleteModal} title="löschen bestätigen" radius="lg" size="sm">
        <Stack gap="md">
          <Stack gap={4}>
            <Text>
              {deleteTarget?.type === "folder"
                ? `Moechtest du den Ordner "${deleteTarget?.name}" wirklich löschen?`
                : `Moechtest du das Projekt "${deleteTarget?.name}" wirklich löschen?`}
            </Text>
            <Text size="sm" c="dimmed">
              {deleteTarget?.description ?? "Dieser Schritt kann nicht rückgängig gemacht werden."}
            </Text>
          </Stack>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDeleteModal}>
              Abbrechen
            </Button>
            <Button color="red" onClick={confirmDelete} loading={deleteLoading} disabled={deleteLoading}>
              löschen
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

type FolderCardProps = {
  node: FolderNode;
  depth: number;
  collapsedFolders: Set<string>;
  onToggleCollapse: (folderId: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onEditFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onAddModule: (folderId: string) => void;
  onEditModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
  disabled: boolean;
};

function FolderCard({
  node,
  depth,
  collapsedFolders,
  onToggleCollapse,
  onAddFolder,
  onEditFolder,
  onDeleteFolder,
  onAddModule,
  onEditModule,
  onDeleteModule,
  disabled,
}: FolderCardProps) {
  const collapsed = collapsedFolders.has(node.id);
  return (
    <Paper withBorder radius="md" p="lg" style={{ marginLeft: depth === 0 ? 0 : depth * 16 }}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <ActionIcon
              variant="transparent"
              color="gray"
              onClick={() => onToggleCollapse(node.id)}
              aria-label={collapsed ? "Ordner ausklappen" : "Ordner einklappen"}
            >
              {collapsed ? <IconChevronRight size={18} /> : <IconChevronDown size={18} />}
            </ActionIcon>
            <div>
              <Text fw={600}>{node.name}</Text>
              <Text size="sm" c="dimmed">
                {node.totalHours.toFixed(1)} h insgesamt
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <ActionIcon
              variant="light"
              color="blue"
              onClick={() => onAddModule(node.id)}
              aria-label="Projekt erstellen"
              disabled={disabled}
            >
              <IconPlus size={16} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              color="yellow"
              onClick={() => onAddFolder(node.id)}
              aria-label="Unterordner erstellen"
              disabled={disabled}
            >
              <IconFolderPlus size={16} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              color="gray"
              onClick={() => onEditFolder(node.id)}
              aria-label="Ordner bearbeiten"
              disabled={disabled}
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              color="red"
              onClick={() => onDeleteFolder(node.id)}
              aria-label="Ordner löschen"
              disabled={disabled}
            >
              <IconFolderMinus size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {!collapsed ? (
          <>
            {node.modules.length > 0 ? (
              <Stack gap="xs">
                {node.modules.map((mod) => (
                  <Paper key={mod.id} withBorder radius="sm" p="sm">
                    <Stack gap={4}>
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Text fw={500}>{mod.name}</Text>
                          {mod.notes ? (
                            <Text size="sm" c="dimmed">
                              {mod.notes}
                            </Text>
                          ) : null}
                        </div>
                        <Group gap="xs">
                          <Text size="sm" c="dimmed">
                            {mod.totalHours.toFixed(1)} h
                          </Text>
                          <ActionIcon
                            variant="light"
                            color="gray"
                            onClick={() => onEditModule(mod.id)}
                            aria-label="Projekt bearbeiten"
                            disabled={disabled}
                          >
                            <IconPencil size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => onDeleteModule(mod.id)}
                            aria-label="Projekt löschen"
                            disabled={disabled}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                      <Text size="sm" c="dimmed">
                        Ziel: {mod.targetHours ? `${mod.targetHours.toFixed(1)} h` : "kein Ziel"}
                      </Text>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Noch keine Projekte in diesem Ordner
              </Text>
            )}

            {node.children.length > 0 ? (
              <Stack gap="sm" mt="sm">
                {node.children.map((child) => (
                  <FolderCard
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    collapsedFolders={collapsedFolders}
                    onToggleCollapse={onToggleCollapse}
                    onAddFolder={onAddFolder}
                    onEditFolder={onEditFolder}
                    onDeleteFolder={onDeleteFolder}
                    onAddModule={onAddModule}
                    onEditModule={onEditModule}
                    onDeleteModule={onDeleteModule}
                    disabled={disabled}
                  />
                ))}
              </Stack>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}

function collectModules(node: FolderNode) {
  const modules = [...node.modules];
  node.children.forEach((child) => {
    modules.push(...collectModules(child));
  });
  return modules;
}














