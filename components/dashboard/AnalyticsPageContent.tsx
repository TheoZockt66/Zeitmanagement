"use client";

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Flex,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  RingProgress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconArrowNarrowLeft, IconChartDonut3, IconChevronRight, IconClockHour9, IconTargetArrow } from "@tabler/icons-react";
import dayjs from "dayjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import type { FolderNode } from "../../hooks/useTimeTracking";
import { useMediaQuery } from "@mantine/hooks";

const DAYS_TO_RENDER = 14;
const DISTRIBUTION_COLORS = ["#4c6ef5", "#82c91e", "#f59f00", "#d6336c", "#20c997", "#7950f2"];

type RingDistributionItem = {
  id: string;
  type: "folder" | "module";
  name: string;
  hours: number;
  color: string;
  parentId: string | null;
};

function ActivityHeatmap({ values }: { values: { date: string; hours: number }[] }) {
  return (
    <Flex gap={8} wrap="wrap">
      {values.map(({ date, hours }) => {
        const intensity = Math.min(1, hours / 4);
        const background = `rgba(99, 102, 241, ${intensity || 0.08})`;
        return (
          <Stack key={date} align="center" gap={4} style={{ width: 56 }}>
            <Text size="xs" c="dimmed">
              {dayjs(date).format("DD.MM.")}
            </Text>
            <Paper
              radius="sm"
              withBorder
              style={{
                width: 44,
                height: 44,
                background,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text size="sm" fw={600}>
                {hours > 0 ? hours.toFixed(1) : "-"}
              </Text>
            </Paper>
          </Stack>
        );
      })}
    </Flex>
  );
}

export default function AnalyticsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 48em)", true);
  const timeTracking = useTimeTracking();
  const {
    folderTree,
    modulesWithRelations,
    flattenedFolders,
    folderDescendantsMap,
    loading: stateLoading,
    initialized,
    error,
    refresh,
  } = timeTracking;

  const initialFolderFilter = (searchParams.get("folder") ?? "all") as "all" | string;
  const [activeFolderId, setActiveFolderId] = useState<"all" | string>(initialFolderFilter);
  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().format("YYYY-MM"));
  const initialLoading = stateLoading && !initialized;

  useEffect(() => {
    const nextValue = (searchParams.get("folder") ?? "all") as "all" | string;
    setActiveFolderId((prev) => (prev === nextValue ? prev : nextValue));
  }, [searchParams]);

  const folderPathMap = useMemo(() => {
    const map = new Map<string, string>();
    flattenedFolders.forEach((folder) => map.set(folder.id, folder.path));
    return map;
  }, [flattenedFolders]);

  const folderOptions = useMemo(
    () => [
      { label: "Alle Ordner", value: "all" },
      ...flattenedFolders.map((folder) => ({
        label: folder.path,
        value: folder.id,
      })),
    ],
    [flattenedFolders],
  );

  const folderNodeMap = useMemo(() => {
    const map = new Map<string, FolderNode>();
    const traverse = (nodes: FolderNode[]) => {
      nodes.forEach((node) => {
        map.set(node.id, node);
        traverse(node.children);
      });
    };
    traverse(folderTree);
    return map;
  }, [folderTree]);

  const activeFolderNode = activeFolderId === "all" ? null : folderNodeMap.get(activeFolderId) ?? null;

  const handleFolderSelection = useCallback(
    (value: string | "all") => {
      setActiveFolderId(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete("folder");
      } else {
        params.set("folder", value);
      }
      const queryString = params.toString();
      router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleNavigateUp = useCallback(() => {
    if (!activeFolderNode) {
      handleFolderSelection("all");
      return;
    }
    if (activeFolderNode.parentId) {
      handleFolderSelection(activeFolderNode.parentId);
    } else {
      handleFolderSelection("all");
    }
  }, [activeFolderNode, handleFolderSelection]);

  const activeFolderLabel =
    activeFolderId === "all" ? "Alle Ordner" : folderPathMap.get(activeFolderId) ?? "Ordner";
  const canNavigateUp = activeFolderId !== "all";

  const allowedFolders = useMemo(() => {
    if (activeFolderId === "all") return null;
    return folderDescendantsMap.get(activeFolderId) ?? new Set([activeFolderId]);
  }, [activeFolderId, folderDescendantsMap]);

  const filteredModules = useMemo(() => {
    if (!allowedFolders) return modulesWithRelations;
    return modulesWithRelations.filter((module) => allowedFolders.has(module.folderId));
  }, [modulesWithRelations, allowedFolders]);

  const distribution = useMemo<RingDistributionItem[]>(() => {
    if (activeFolderId === "all" || !activeFolderNode) {
      return folderTree.map((folder, index) => ({
        id: folder.id,
        type: "folder" as const,
        name: folder.name,
        hours: folder.totalHours,
        color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
        parentId: folder.parentId,
      }));
    }

    const items: RingDistributionItem[] = [];
    let colorIndex = 0;

    const children = [...activeFolderNode.children].sort((a, b) => a.order - b.order);
    children.forEach((child) => {
      items.push({
        id: child.id,
        type: "folder",
        name: child.name,
        hours: child.totalHours,
        color: DISTRIBUTION_COLORS[colorIndex % DISTRIBUTION_COLORS.length],
        parentId: child.parentId,
      });
      colorIndex += 1;
    });

    const modules = [...activeFolderNode.modules].sort((a, b) => a.order - b.order);
    modules.forEach((mod) => {
      items.push({
        id: mod.id,
        type: "module",
        name: mod.name,
        hours: mod.totalHours,
        color: DISTRIBUTION_COLORS[colorIndex % DISTRIBUTION_COLORS.length],
        parentId: activeFolderNode.id,
      });
      colorIndex += 1;
    });

    return items;
  }, [activeFolderId, activeFolderNode, folderTree]);

  const distributionTotal = distribution.reduce((sum, item) => sum + item.hours, 0);

  const buildEntriesHref = useCallback((item: RingDistributionItem) => {
    const params = new URLSearchParams();
    if (item.type === "folder") {
      params.set("folder", item.id);
    } else {
      params.set("module", item.id);
      if (item.parentId) {
        params.set("folder", item.parentId);
      }
    }
    const query = params.toString();
    return `/entries${query ? `?${query}` : ""}`;
  }, []);

  const handleRingSectionClick = useCallback(
    (item: RingDistributionItem) => {
      if (item.type === "folder") {
        handleFolderSelection(item.id);
      } else {
        router.push(buildEntriesHref(item));
      }
    },
    [buildEntriesHref, handleFolderSelection, router],
  );

  const ringSections =
    distributionTotal > 0
      ? distribution.map((item) => ({
          value: (item.hours / distributionTotal) * 100,
          color: item.color,
          tooltip: `${item.name}: ${item.hours.toFixed(1)} h`,
          onClick: () => handleRingSectionClick(item),
          style: { cursor: "pointer" },
        }))
      : [{ value: 100, color: "gray.4" }];

  const monthBuckets = useMemo(() => {
    const entries = filteredModules.flatMap((module) => module.entries);
    return entries.reduce<Map<string, Map<string, number>>>((acc, entry) => {
      const entryDate = dayjs(entry.timestamp);
      const monthKey = entryDate.format("YYYY-MM");
      const dayKey = entryDate.format("YYYY-MM-DD");
      if (!acc.has(monthKey)) {
        acc.set(monthKey, new Map());
      }
      const monthMap = acc.get(monthKey)!;
      monthMap.set(dayKey, (monthMap.get(dayKey) ?? 0) + entry.durationHours);
      return acc;
    }, new Map());
  }, [filteredModules]);

  const monthlyOptions = useMemo(() => {
    const currentMonthKey = dayjs().format("YYYY-MM");
    const monthKeys = new Set<string>([currentMonthKey]);
    monthBuckets.forEach((_value, key) => monthKeys.add(key));
    const sortedKeys = Array.from(monthKeys).sort((a, b) => b.localeCompare(a));
    return sortedKeys.map((value) => {
      const labelDate = dayjs(`${value}-01`);
      return {
        value,
        label: labelDate.isValid() ? labelDate.format("MMMM YYYY") : value,
      };
    });
  }, [monthBuckets]);

  useEffect(() => {
    if (monthlyOptions.length === 0) {
      return;
    }
    if (!selectedMonth || !monthlyOptions.some((option) => option.value === selectedMonth)) {
      setSelectedMonth(monthlyOptions[0].value);
    }
  }, [monthlyOptions, selectedMonth]);

  const monthlyHeatmapValues = useMemo(() => {
    if (!selectedMonth) {
      return [];
    }
    const startOfMonth = dayjs(`${selectedMonth}-01`);
    if (!startOfMonth.isValid()) {
      return [];
    }
    const daysInMonth = startOfMonth.daysInMonth();
    const selectedMonthMap = monthBuckets.get(selectedMonth) ?? new Map();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = startOfMonth.date(index + 1);
      const dayKey = date.format("YYYY-MM-DD");
      return { date: dayKey, hours: selectedMonthMap.get(dayKey) ?? 0 };
    });
  }, [monthBuckets, selectedMonth]);

  const monthlyTotalHours = useMemo(
    () => monthlyHeatmapValues.reduce((sum, { hours }) => sum + hours, 0),
    [monthlyHeatmapValues],
  );

  const hoursByDay = useMemo(() => {
    const today = dayjs();
    return Array.from({ length: DAYS_TO_RENDER }, (_, index) => {
      const date = today.subtract(DAYS_TO_RENDER - index - 1, "day");
      const hours = filteredModules
        .flatMap((module) => module.entries)
        .filter((entry) => dayjs(entry.timestamp).isSame(date, "day"))
        .reduce((sum, entry) => sum + entry.durationHours, 0);
      return { date: date.format("YYYY-MM-DD"), hours };
    });
  }, [filteredModules]);

  const averagePerDay = useMemo(() => {
    const totalDays = Math.max(1, DAYS_TO_RENDER);
    const totalHours = hoursByDay.reduce((sum, { hours }) => sum + hours, 0);
    return totalHours / totalDays;
  }, [hoursByDay]);

  const modulesWithProgress = useMemo(() => {
    return filteredModules.map((module) => {
      const target = module.targetHours ?? 0;
      const progress = target > 0 ? Math.min(100, (module.totalHours / target) * 100) : 0;
      return { ...module, target, progress };
    });
  }, [filteredModules]);

  if (initialLoading) {
    return (
      <Center mih="70vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <>
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>Auswertungen</Title>
          <Text c="dimmed">
            Analysiere deine Lernzeiten nach Ordnern und Projekten.
          </Text>
        </Stack>

      <Card padding="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={600}>Ansicht filtern</Text>
              <Text size="sm" c="dimmed">
                Waehle einen Ordner oder Unterordner fuer detaillierte Kennzahlen.
              </Text>
            </Stack>
            {canNavigateUp ? (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconArrowNarrowLeft size={14} />}
                onClick={handleNavigateUp}
              >
                Zurück
              </Button>
            ) : null}
          </Group>
          <Select
            label="Ordner"
            placeholder="Ordner auswaehlen"
            data={folderOptions}
            value={activeFolderId}
            onChange={(value) => handleFolderSelection((value ?? "all") as string | "all")}
            searchable
            allowDeselect={false}
          />
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card padding="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Durchschnitt / Tag
            </Text>
            <Title order={4}>{averagePerDay.toFixed(2)} h</Title>
          </Stack>
        </Card>
        <Card padding="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Module mit Zielzeit
            </Text>
            <Title order={4}>
              {modulesWithProgress.filter((module) => module.target > 0).length}
            </Title>
          </Stack>
        </Card>
        <Card padding="md">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Module ≥ 5 h
            </Text>
            <Title order={4}>
              {modulesWithProgress.filter((module) => module.totalHours >= 5).length}
            </Title>
          </Stack>
        </Card>
      </SimpleGrid>

      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper radius="md" p="xl">
            <Stack gap="lg">
              <Group gap="sm" align="flex-start">
                <IconChartDonut3 size={22} />
                <Stack gap={2}>
                  <Title order={4}>Zeitverteilung</Title>
                  <Text size="sm" c="dimmed">
                    {activeFolderLabel}
                  </Text>
                </Stack>
              </Group>
              <RingProgress
                size={220}
                thickness={28}
                sections={ringSections}
                label={
                  <Stack gap={4} align="center">
                    <Text size="sm" c="dimmed">
                      Gesamt
                    </Text>
                    <Title order={3}>{distributionTotal.toFixed(1)} h</Title>
                  </Stack>
                }
              />
              <Stack gap="sm">
                {distribution.map((item) => {
                  const entriesHref = buildEntriesHref(item);
                  const isFolder = item.type === "folder";
                  return (
                    <Group key={item.id} justify="space-between" align="center">
                      <Group gap="sm" align="center">
                        <Box
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            backgroundColor: item.color,
                          }}
                        />
                        <Stack gap={2} style={{ minWidth: 0 }}>
                          <Group gap={6} align="center">
                            <Text fw={500}>{item.name}</Text>
                            <Badge size="xs" variant="light" color={isFolder ? "indigo" : "gray"}>
                              {isFolder ? "Ordner" : "Projekt"}
                            </Badge>
                          </Group>
                        </Stack>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" c="dimmed">
                          {item.hours.toFixed(1)} h
                        </Text>
                        {isFolder ? (
                          <Tooltip label="In Unterordner wechseln" withArrow>
                            <Button
                              size="xs"
                              variant="light"
                              rightSection={<IconChevronRight size={14} />}
                              onClick={() => handleFolderSelection(item.id)}
                            >
                              Details
                            </Button>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Zeiterfassung mit Filter öffnen" withArrow>
                            <Button
                              size="xs"
                              variant="subtle"
                              component={Link}
                              href={entriesHref}
                            >
                              Einträge
                            </Button>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>
                  );
                })}
                {distribution.length === 0 ? (
                  <Center>
                    <Text c="dimmed">Keine Daten vorhanden.</Text>
                  </Center>
                ) : null}
              </Stack>
            </Stack>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper radius="md" p="xl">
            <Stack gap="md">
              <Group gap="sm">
                <IconTargetArrow size={22} />
                <Title order={4}>Fortschritt der Projekte</Title>
              </Group>
              <Stack gap="md">
                {modulesWithProgress.length === 0 ? (
                  <Center py="xl">
                    <Text c="dimmed">Noch keine Projekte erfasst.</Text>
                  </Center>
                ) : (
                  modulesWithProgress.map((module) => (
                    <Stack gap={6} key={module.id}>
                      <Group justify="space-between" align="flex-end">
                        <div>
                          <Text fw={600}>{module.name}</Text>
                          <Text size="sm" c="dimmed">
                            {folderPathMap.get(module.folderId) ?? "—"}
                          </Text>
                        </div>
                        <Text size="sm" c="dimmed">
                          {module.totalHours.toFixed(1)} / {module.target > 0 ? module.target.toFixed(1) : "∞"} h
                        </Text>
                      </Group>
                      <Progress color="indigo" radius="xl" size="lg" value={module.progress} />
                    </Stack>
                  ))
                )}
              </Stack>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <Paper radius="md" p="xl">
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
                      console.error("[Zeitmanagement] Dashboard-Refresh fehlgeschlagen", err);
                    });
                  }}
                  loading={stateLoading}
                >
                  Erneut laden
                </Button>
              </Group>
            </Alert>
          ) : null}

          <Group justify="space-between" align="center">
            <Group gap="sm">
              <IconClockHour9 size={22} />
              <Title order={4}>Aktivitäten der letzten {DAYS_TO_RENDER} Tage</Title>
            </Group>
            <Button
              size="xs"
              variant="light"
              onClick={() => setMonthlyModalOpen(true)}
              disabled={monthlyOptions.length === 0}
            >
              Monatsverteilung
            </Button>
          </Group>
          <ActivityHeatmap values={hoursByDay} />
        </Stack>
      </Paper>

      <Paper radius="md" p="xl">
        <Stack gap="md">
          <Title order={4}>Detailtabelle</Title>
          {isMobile ? (
            modulesWithProgress.length === 0 ? (
              <Center py="xl">
                <Text c="dimmed">Keine Projekte vorhanden.</Text>
              </Center>
            ) : (
              <Stack gap="sm">
                {modulesWithProgress.map((module) => (
                  <Paper key={module.id} withBorder radius="md" p="md" shadow="xs">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={2}>
                          <Text fw={600}>{module.name}</Text>
                          <Text size="sm" c="dimmed">
                            {folderPathMap.get(module.folderId) ?? "—"}
                          </Text>
                        </Stack>
                        <Badge size="sm" variant="light" color="indigo">
                          {module.entries.length} Einträge
                        </Badge>
                      </Group>
                      <Group justify="space-between" align="center">
                        <Text size="sm" c="dimmed">
                          Ist / Ziel
                        </Text>
                        <Text fw={600}>
                          {module.totalHours.toFixed(1)} h / {module.target > 0 ? `${module.target.toFixed(1)} h` : "–"}
                        </Text>
                      </Group>
                      <Progress color="indigo" radius="xl" value={module.progress} />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )
          ) : (
            <Table highlightOnHover striped withColumnBorders withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Projekt</Table.Th>
                  <Table.Th>Ordner</Table.Th>
                  <Table.Th>Einträge</Table.Th>
                  <Table.Th>Ist-Stunden</Table.Th>
                  <Table.Th>Ziel-Stunden</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {modulesWithProgress.map((module) => (
                  <Table.Tr key={module.id}>
                    <Table.Td>{module.name}</Table.Td>
                    <Table.Td>{folderPathMap.get(module.folderId) ?? "—"}</Table.Td>
                    <Table.Td>{module.entries.length}</Table.Td>
                    <Table.Td>{module.totalHours.toFixed(1)} h</Table.Td>
                    <Table.Td>{module.target > 0 ? `${module.target.toFixed(1)} h` : "-"}</Table.Td>
                  </Table.Tr>
                ))}
                {modulesWithProgress.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Center py="xl">
                        <Text c="dimmed">Keine Projekte vorhanden.</Text>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>
    </Stack>

    <Modal
      opened={monthlyModalOpen}
      onClose={() => setMonthlyModalOpen(false)}
      title="Monatsverteilung der Aktivitäten"
      size="lg"
    >
      {monthlyOptions.length === 0 ? (
        <Text c="dimmed">Noch keine Zeiteinträge vorhanden.</Text>
      ) : (
        <Stack gap="md">
          <Select
            label="Monat"
            data={monthlyOptions}
            value={selectedMonth}
            onChange={(value) => {
              if (value) {
                setSelectedMonth(value);
              }
            }}
            allowDeselect={false}
          />
          <Group justify="space-between" align="flex-end">
            <Text size="sm" c="dimmed">
              Gesamtstunden in diesem Monat
            </Text>
            <Text fw={600}>{monthlyTotalHours.toFixed(1)} h</Text>
          </Group>
          <ActivityHeatmap values={monthlyHeatmapValues} />
        </Stack>
      )}
    </Modal>
    </>
  );
}
