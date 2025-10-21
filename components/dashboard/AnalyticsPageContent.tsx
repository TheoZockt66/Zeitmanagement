"use client";

import {
  Alert,
  Button,
  Card,
  Center,
  Flex,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  RingProgress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconChartDonut3, IconClockHour9, IconTargetArrow } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTimeTracking } from "../../hooks/useTimeTracking";

const DAYS_TO_RENDER = 14;
const DISTRIBUTION_COLORS = ["#4c6ef5", "#82c91e", "#f59f00", "#d6336c", "#20c997", "#7950f2"];

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
  const timeTracking = useTimeTracking();
  const {
    folderTree,
    modulesWithRelations,
    flattenedFolders,
    folderDescendantsMap,
    totalTrackedHours,
    loading: stateLoading,
    initialized,
    error,
    refresh,
  } = timeTracking;

  const initialFolderFilter = searchParams.get("folder") ?? "all";
  const [activeFolder, setActiveFolder] = useState(initialFolderFilter);
  const initialLoading = stateLoading && !initialized;

  const handleSegmentChange = (value: string) => {
    setActiveFolder(value);
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("folder");
    } else {
      params.set("folder", value);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const segmentData = useMemo(() => {
    const base = [{ label: "Alle", value: "all" }];
    const roots = folderTree.map((folder) => ({ label: folder.name, value: folder.id }));
    return [...base, ...roots];
  }, [folderTree]);

  const allowedFolders = useMemo(() => {
    if (activeFolder === "all" || !activeFolder) return null;
    return folderDescendantsMap.get(activeFolder) ?? new Set([activeFolder]);
  }, [activeFolder, folderDescendantsMap]);

  const filteredModules = useMemo(() => {
    if (!allowedFolders) return modulesWithRelations;
    return modulesWithRelations.filter((module) => allowedFolders.has(module.folderId));
  }, [modulesWithRelations, allowedFolders]);

  const distribution = useMemo(() => {
    const roots = activeFolder === "all" ? folderTree : folderTree.filter((folder) => folder.id === activeFolder);
    return roots.map((folder, index) => ({
      id: folder.id,
      name: folder.name,
      hours: folder.totalHours,
      color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
    }));
  }, [folderTree, activeFolder]);

  const ringSections = useMemo(() => {
    if (distribution.length === 0 || totalTrackedHours === 0) {
      return [{ value: 100, color: "gray.4" }];
    }
    return distribution.map((item) => ({
      value: (item.hours / totalTrackedHours) * 100,
      color: item.color,
      tooltip: `${item.name}: ${item.hours.toFixed(1)} h`,
    }));
  }, [distribution, totalTrackedHours]);

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

  const folderPathMap = useMemo(() => {
    const map = new Map<string, string>();
    flattenedFolders.forEach((folder) => map.set(folder.id, folder.path));
    return map;
  }, [flattenedFolders]);

  if (initialLoading) {
    return (
      <Center mih="70vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>Auswertungen</Title>
        <Text c="dimmed">
          Analysiere deine Lernzeiten nach Ordnern und Projekten.
        </Text>
      </Stack>

      <Card padding="md" radius="md">
        <Stack gap="md">
          <Text fw={600}>Ansicht filtern</Text>
          <SegmentedControl
            fullWidth
            radius="xl"
            value={activeFolder}
            onChange={handleSegmentChange}
            data={segmentData}
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
            <Stack gap="md" align="center">
              <Group gap="sm">
                <IconChartDonut3 size={22} />
                <Title order={4}>Zeitverteilung</Title>
              </Group>
              <RingProgress
                size={220}
                thickness={28}
                label={
                  <Stack gap={4} align="center">
                    <Text size="sm" c="dimmed">
                      Gesamt
                    </Text>
                    <Title order={3}>{totalTrackedHours.toFixed(1)} h</Title>
                  </Stack>
                }
                sections={ringSections}
              />
              <Stack gap={6} w="100%">
                {distribution.map((item) => (
                  <Group key={item.id} justify="space-between">
                    <Group gap={8} align="center">
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          display: "inline-block",
                          backgroundColor: item.color,
                        }}
                      />
                      <Text>{item.name}</Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {item.hours.toFixed(1)} h
                    </Text>
                  </Group>
                ))}
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

          <Group gap="sm">
            <IconClockHour9 size={22} />
            <Title order={4}>Aktivitäten der letzten {DAYS_TO_RENDER} Tage</Title>
          </Group>
          <ActivityHeatmap values={hoursByDay} />
        </Stack>
      </Paper>

      <Paper radius="md" p="xl">
        <Stack gap="md">
          <Title order={4}>Detailtabelle</Title>
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
                  <Table.Td>{module.target > 0 ? `${module.target.toFixed(1)} h` : "—"}</Table.Td>
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
        </Stack>
      </Paper>
    </Stack>
  );
}










