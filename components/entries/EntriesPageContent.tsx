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
import { IconFilterOff, IconPlus, IconRefresh } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import { EntryForm } from "./EntryForm";

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
  } = useTimeTracking();
  const isMobile = useMediaQuery("(max-width: 48em)");

  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  const moduleLookup = useMemo(
    () => new Map(modulesWithRelations.map((mod) => [mod.id, mod])),
    [modulesWithRelations],
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

  const resetFilters = () => {
    setFolderFilter(null);
    setModuleFilter(null);
    setDateRange([null, null]);
  };

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
            onClick={openModal}
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
                onChange={(value) => {
                  setFolderFilter(value);
                  setModuleFilter(null);
                }}
                clearable
                maw={isMobile ? "100%" : 220}
              />
              <Select
                label="Projekt"
                placeholder="Alle Projekte"
                data={moduleOptions}
                value={moduleFilter}
                onChange={setModuleFilter}
                disabled={moduleOptions.length === 0}
                clearable
                maw={isMobile ? "100%" : 220}
              />
              <DatePickerInput
                type="range"
                label="Zeitraum"
                placeholder="Zeitraum wählen"
                value={dateRange}
                onChange={setDateRange}
                locale="de"
                allowSingleDateInRange
                clearable
                maw={isMobile ? "100%" : 220}
              />
              <ActionIcon
                variant="outline"
                size="lg"
                radius="md"
                aria-label="Filter zurücksetzen"
                onClick={resetFilters}
              >
                <IconFilterOff size={18} />
              </ActionIcon>
            </Group>
          </Stack>
        </Card>

        <Paper radius="md">
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
                    </Table.Tr>
                  );
                })}
                {filteredEntries.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
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
        </Paper>
      </Stack>

      <Modal opened={modalOpened} onClose={closeModal} title="Neue Lernzeit erfassen" size="lg" radius="lg">
        <EntryForm onSuccess={closeModal} />
      </Modal>
    </>
  );
}

function resolveFolderPath(folderId: string, folders: { id: string; path: string }[]) {
  const folder = folders.find((item) => item.id === folderId);
  return folder ? folder.path : "-";
}

