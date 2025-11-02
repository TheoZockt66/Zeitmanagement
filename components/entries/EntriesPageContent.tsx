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
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconFilterOff, IconPlus, IconRefresh, IconPencil, IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { notifications } from "@mantine/notifications";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import { EntryForm } from "./EntryForm";
import type { TimeEntry } from "../../types/time";

export default function EntriesPageContent() {
  const {
    entriesSorted,
    modulesWithRelations,
    flattenedFolders,
    folderDescendantsMap,
    getModuleById,
    loading: stateLoading,
    initialized,
    error,
    refresh,
    deleteEntry,
    isMutating,
  } = useTimeTracking();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [folderFilter, setFolderFilter] = useState<string | null>(() => searchParams.get("folder"));
  const [moduleFilter, setModuleFilter] = useState<string | null>(() => searchParams.get("module"));
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => [
    parseDateParam(searchParams.get("from")),
    parseDateParam(searchParams.get("to")),
  ]);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const moduleLookup = useMemo(
    () => new Map(modulesWithRelations.map((mod) => [mod.id, mod])),
    [modulesWithRelations],
  );

  useEffect(() => {
    const nextFolder = searchParams.get("folder");
    const nextModuleParam = searchParams.get("module");
    const nextRange: [Date | null, Date | null] = [
      parseDateParam(searchParams.get("from")),
      parseDateParam(searchParams.get("to")),
    ];

    setFolderFilter((prev) => (prev === (nextFolder ?? null) ? prev : nextFolder));

    const moduleCandidate = nextModuleParam ? moduleLookup.get(nextModuleParam) : null;
    const allowedFolders = nextFolder ? folderDescendantsMap.get(nextFolder) ?? new Set([nextFolder]) : null;
    const moduleValid = moduleCandidate && (!allowedFolders || allowedFolders.has(moduleCandidate.folderId));
    const resolvedModule = moduleValid ? nextModuleParam : null;

    setModuleFilter((prev) => (prev === resolvedModule ? prev : resolvedModule));

    setDateRange((prev) => (areDateRangesEqual(prev, nextRange) ? prev : nextRange));
  }, [searchParams, moduleLookup, folderDescendantsMap]);

  const updateQuery = useCallback(
    (changes: { folder?: string | null; module?: string | null; dateRange?: [Date | null, Date | null] }) => {
      const params = new URLSearchParams(searchParams.toString());

      if ("folder" in changes) {
        const value = changes.folder;
        if (value) {
          params.set("folder", value);
        } else {
          params.delete("folder");
        }
      }

      if ("module" in changes) {
        const value = changes.module;
        if (value) {
          params.set("module", value);
        } else {
          params.delete("module");
        }
      }

      if ("dateRange" in changes) {
        const [from, to] = changes.dateRange ?? [null, null];
        const fromToken = formatDateParam(from);
        const toToken = formatDateParam(to);

        if (fromToken) {
          params.set("from", fromToken);
        } else {
          params.delete("from");
        }

        if (toToken) {
          params.set("to", toToken);
        } else {
          params.delete("to");
        }
      }

      const queryString = params.toString();
      router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleFolderChange = useCallback(
    (value: string | null) => {
      setFolderFilter(value);
      setModuleFilter(null);
      updateQuery({ folder: value, module: null });
    },
    [updateQuery],
  );

  const handleModuleChange = useCallback(
    (value: string | null) => {
      setModuleFilter(value);
      updateQuery({ module: value });
    },
    [updateQuery],
  );

  const handleDateRangeChange = useCallback(
    (value: [Date | null, Date | null]) => {
      setDateRange(value);
      updateQuery({ dateRange: value });
    },
    [updateQuery],
  );

  const moduleOptions = useMemo(() => {
    const allowedFolders = folderFilter ? folderDescendantsMap.get(folderFilter) ?? new Set([folderFilter]) : null;
    return modulesWithRelations
      .filter((mod) => !allowedFolders || allowedFolders.has(mod.folderId))
      .map((mod) => ({
        label: mod.name,
        value: mod.id,
      }));
  }, [modulesWithRelations, folderFilter, folderDescendantsMap]);

  const filteredEntries = useMemo(() => {
    const allowedFolders = folderFilter ? folderDescendantsMap.get(folderFilter) ?? new Set([folderFilter]) : null;
    return entriesSorted.filter((entry) => {
      const mod = moduleLookup.get(entry.moduleId);
      if (!mod) return false;
      if (allowedFolders && !allowedFolders.has(mod.folderId)) return false;
      if (moduleFilter && entry.moduleId !== moduleFilter) return false;
      if (dateRange[0] && dayjs(entry.timestamp).isBefore(dayjs(dateRange[0]).startOf("day"))) return false;
      if (dateRange[1] && dayjs(entry.timestamp).isAfter(dayjs(dateRange[1]).endOf("day"))) return false;
      return true;
    });
  }, [entriesSorted, moduleLookup, folderFilter, folderDescendantsMap, moduleFilter, dateRange]);

  const resetFilters = useCallback(() => {
    setFolderFilter(null);
    setModuleFilter(null);
    setDateRange([null, null]);
    updateQuery({ folder: null, module: null, dateRange: [null, null] });
  }, [updateQuery]);

  const handleOpenCreateModal = () => {
    setEditingEntry(null);
    openModal();
  };

  const handleOpenEditModal = (entry: TimeEntry) => {
    setEditingEntry(entry);
    openModal();
  };

  const handleCloseModal = () => {
    closeModal();
    setEditingEntry(null);
  };

  const handleEntrySuccess = () => {
    handleCloseModal();
  };

  const handleRequestDelete = (entry: TimeEntry) => {
    setDeleteTarget(entry);
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteEntry(deleteTarget.id);
      notifications.show({
        title: "Eintrag entfernt",
        message: "Der Eintrag wurde geloescht.",
        color: "green",
      });
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Eintrag konnte nicht geloescht werden.";
      notifications.show({
        title: "Loeschen fehlgeschlagen",
        message,
        color: "red",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const actionDisabled = stateLoading || isMutating || deleteLoading;

  const initialLoading = stateLoading && !initialized;

  if (initialLoading) {
    return (
      <Center mih="70vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <>
      <Stack gap="lg">
        {error ? (
          <Alert color="red" variant="light" title="Synchronisationsfehler" withCloseButton={false}>
            <Group justify="space-between" align="center">
              <Text fw={500}>{error}</Text>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  refresh({ withSpinner: true }).catch((err) => {
                    console.error("[Zeitmanagement] Refresh der Einträge fehlgeschlagen", err);
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
            <Title order={2}>Zeiterfassung</Title>
            <Text c="dimmed">
              Verwalte deine Lernzeiten, filtere nach Ordnern und Projekten und halte sie für spätere Auswertungen fest.
            </Text>
          </Stack>
          <Button
            leftSection={<IconPlus size={18} />}
            size="md"
            onClick={handleOpenCreateModal}
            disabled={stateLoading}
            fullWidth={isMobile}
          >
            Neuer Eintrag
          </Button>
        </Group>

        <Card padding="md" radius="md">
          <Stack gap="md">
            <Group grow align="flex-end" wrap="wrap">
              <Select
                label="Ordner"
                placeholder="Alle Ordner"
                data={flattenedFolders.map((folder) => ({
                  label: folder.path,
                  value: folder.id,
                }))}
                value={folderFilter}
                onChange={handleFolderChange}
                clearable
                maw={isMobile ? "100%" : 220}
              />
              <Select
                label="Projekt"
                placeholder="Alle Projekte"
                data={moduleOptions}
                value={moduleFilter}
                onChange={handleModuleChange}
                disabled={moduleOptions.length === 0}
                clearable
                maw={isMobile ? "100%" : 220}
              />
              <DatePickerInput
                type="range"
                label="Zeitraum"
                placeholder="Zeitraum waehlen"
                value={dateRange}
                onChange={handleDateRangeChange}
                locale="de"
                allowSingleDateInRange
                clearable
                maw={isMobile ? "100%" : 220}
              />
              <ActionIcon
                variant="outline"
                size="lg"
                radius="md"
                aria-label="Filter zuruecksetzen"
                onClick={resetFilters}
              >
                <IconFilterOff size={18} />
              </ActionIcon>
            </Group>
          </Stack>
        </Card>

        <Paper radius="md" p={isMobile ? "md" : undefined}>
          {isMobile ? (
            <Stack gap="sm">
              {filteredEntries.length === 0 ? (
                <Stack align="center" py="xl" gap="xs">
                  <IconRefresh size={28} stroke={1.5} />
                  <Text c="dimmed">Keine Einträge in diesem Filter gefunden.</Text>
                </Stack>
              ) : (
                filteredEntries.map((entry) => {
                  const mod = moduleLookup.get(entry.moduleId) ?? getModuleById(entry.moduleId);
                  const folderPath = mod ? resolveFolderPath(mod.folderId, flattenedFolders) : "-";
                  return (
                    <Paper key={entry.id} withBorder radius="md" p="md" shadow="xs">
                      <Stack gap="sm">
                        <Group justify="space-between" align="flex-start">
                          <Stack gap={2}>
                            <Text fw={600}>{mod?.name ?? "Unbekanntes Projekt"}</Text>
                            <Text size="sm" c="dimmed">
                              {folderPath}
                            </Text>
                          </Stack>
                          <Group gap="xs" align="center">
                            <Text size="sm" fw={600}>
                              {entry.durationHours.toFixed(2)} h
                            </Text>
                            <ActionIcon
                              variant="light"
                              color="gray"
                              onClick={() => handleOpenEditModal(entry)}
                              aria-label="Eintrag bearbeiten"
                              disabled={actionDisabled}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleRequestDelete(entry)}
                              aria-label="Eintrag loeschen"
                              disabled={actionDisabled}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                        <Group justify="space-between" wrap="wrap" gap="sm">
                          <Text size="sm">{entry.activityType}</Text>
                          <Text size="sm" c="dimmed">
                            {dayjs(entry.timestamp).format("DD.MM.YYYY")}
                          </Text>
                        </Group>
                        {entry.description ? (
                          <Text size="sm" c="dimmed">
                            {entry.description}
                          </Text>
                        ) : null}
                      </Stack>
                    </Paper>
                  );
                })
              )}
            </Stack>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder withColumnBorders miw={800}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Datum</Table.Th>
                    <Table.Th>Ordner</Table.Th>
                    <Table.Th>Modul</Table.Th>
                    <Table.Th>Tätigkeit</Table.Th>
                    <Table.Th>Beschreibung</Table.Th>
                    <Table.Th ta="right">Dauer (h)</Table.Th>
                    <Table.Th ta="right">Aktionen</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredEntries.map((entry) => {
                    const mod = moduleLookup.get(entry.moduleId) ?? getModuleById(entry.moduleId);
                    const folderPath = mod ? resolveFolderPath(mod.folderId, flattenedFolders) : "-";
                    return (
                      <Table.Tr key={entry.id}>
                        <Table.Td>{dayjs(entry.timestamp).format("DD.MM.YYYY")}</Table.Td>
                        <Table.Td>{folderPath}</Table.Td>
                        <Table.Td>
                          <Text fw={600}>{mod?.name ?? "Unbekannt"}</Text>
                        </Table.Td>
                        <Table.Td>{entry.activityType}</Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {entry.description ?? "-"}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" fw={600}>
                          {entry.durationHours.toFixed(2)}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="flex-end">
                            <ActionIcon
                              variant="light"
                              color="gray"
                              onClick={() => handleOpenEditModal(entry)}
                              aria-label="Eintrag bearbeiten"
                              disabled={actionDisabled}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleRequestDelete(entry)}
                              aria-label="Eintrag loeschen"
                              disabled={actionDisabled}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                  {filteredEntries.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Stack align="center" py="xl" gap="xs">
                          <IconRefresh size={28} stroke={1.5} />
                          <Text c="dimmed">Keine Einträge in diesem Filter gefunden.</Text>
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  ) : null}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Paper>
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={handleCloseModal}
        title={editingEntry ? "Eintrag bearbeiten" : "Neue Lernzeit erfassen"}
        size="lg"
        radius="lg"
      >
        <EntryForm key={editingEntry?.id ?? "new"} onSuccess={handleEntrySuccess} entry={editingEntry ?? undefined} />
      </Modal>

      <Modal opened={Boolean(deleteTarget)} onClose={handleCancelDelete} title="Eintrag loeschen" radius="lg" size="sm">
        <Stack gap="md">
          <Text>
            Moechtest du den Eintrag{" "}
            <Text component="span" fw={600}>
              {deleteTarget?.activityType ?? ""}
            </Text>{" "}
            vom {deleteTarget ? dayjs(deleteTarget.timestamp).format("DD.MM.YYYY") : ""} wirklich loeschen?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={handleCancelDelete} disabled={deleteLoading}>
              Abbrechen
            </Button>
            <Button color="red" onClick={handleConfirmDelete} loading={deleteLoading}>
              Loeschen
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function resolveFolderPath(folderId: string, folders: { id: string; path: string }[]) {
  const folder = folders.find((item) => item.id === folderId);
  return folder ? folder.path : "-";
}

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const strict = dayjs(value, "YYYY-MM-DD", true);
  const parsed = strict.isValid() ? strict : dayjs(value);
  return parsed.isValid() ? parsed.toDate() : null;
}

function formatDateParam(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return dayjs(value).format("YYYY-MM-DD");
}

function areDateRangesEqual(a: [Date | null, Date | null], b: [Date | null, Date | null]) {
  const [aStart, aEnd] = a;
  const [bStart, bEnd] = b;
  const sameStart =
    (aStart === null && bStart === null) ||
    (aStart !== null && bStart !== null && dayjs(aStart).isSame(bStart, "day"));
  const sameEnd =
    (aEnd === null && bEnd === null) ||
    (aEnd !== null && bEnd !== null && dayjs(aEnd).isSame(bEnd, "day"));
  return sameStart && sameEnd;
}

