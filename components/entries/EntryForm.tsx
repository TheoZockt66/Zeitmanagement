"use client";

import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import {
  IconClockCheck,
  IconClockPlay,
  IconPlayerPause,
  IconPlayerPlay,
  IconRotateClockwise,
} from "@tabler/icons-react";

type EntryFormValues = {
  folderId: string;
  moduleId: string;
  activityType: string;
  description: string;
  durationHours: number;
  timestamp: Date | null;
};

export function EntryForm({ onSuccess }: { onSuccess?: () => void }) {
  const { modulesWithRelations, flattenedFolders, addEntry } = useTimeTracking();

  const moduleMap = useMemo(() => new Map(modulesWithRelations.map((module) => [module.id, module])), [modulesWithRelations]);

  const initialFormValues = useMemo<EntryFormValues>(() => {
    const firstModule = modulesWithRelations[0];
    const fallbackFolder = flattenedFolders[0];
    const folderId = firstModule?.folderId ?? fallbackFolder?.id ?? "";
    const moduleForFolder = modulesWithRelations.find((module) => module.folderId === folderId);
    return {
      folderId,
      moduleId: moduleForFolder?.id ?? firstModule?.id ?? "",
      activityType: "",
      description: "",
      durationHours: 1,
      timestamp: new Date(),
    };
  }, [modulesWithRelations, flattenedFolders]);

  const [formValues, setFormValues] = useState<EntryFormValues>(initialFormValues);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!formValues.folderId && initialFormValues.folderId) {
      setFormValues(initialFormValues);
    }
  }, [initialFormValues, formValues.folderId]);

  const folderOptions = useMemo(
    () =>
      flattenedFolders.map((folder) => ({
        label: folder.path,
        value: folder.id,
      })),
    [flattenedFolders],
  );

  const moduleOptions = useMemo(() => {
    if (!formValues.folderId) return [];
    return modulesWithRelations
      .filter((module) => module.folderId === formValues.folderId)
      .map((module) => ({
        label: module.name,
        value: module.id,
      }));
  }, [modulesWithRelations, formValues.folderId]);

  const handleFolderChange = (value: string | null) => {
    const newFolderId = value ?? "";
    const firstModule = modulesWithRelations.find((module) => module.folderId === newFolderId);
    setFormValues((prev) => ({
      ...prev,
      folderId: newFolderId,
      moduleId: firstModule?.id ?? "",
    }));
  };

  const handleModuleChange = (value: string | null) => {
    if (!value) {
      setFormValues((prev) => ({ ...prev, moduleId: "" }));
      return;
    }
    const targetModule = moduleMap.get(value);
    if (!targetModule) return;
    setFormValues((prev) => ({
      ...prev,
      moduleId: targetModule.id,
      folderId: targetModule.folderId,
    }));
  };

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const convertSecondsToHours = useCallback((seconds: number) => {
    return Math.round((seconds / 3600) * 100) / 100;
  }, []);

  const applyTimerToDuration = useCallback(
    (seconds: number) => {
      const hours = convertSecondsToHours(seconds);
      setFormValues((prev) =>
        prev.durationHours === hours ? prev : { ...prev, durationHours: hours },
      );
    },
    [convertSecondsToHours],
  );

  const startTimer = useCallback(() => {
    if (timerRunning) return;
    if (typeof window === "undefined") return;
    setTimerRunning(true);
    const now = Date.now();
    startTimestampRef.current = now - timerSeconds * 1000;
    intervalRef.current = window.setInterval(() => {
      if (!startTimestampRef.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startTimestampRef.current) / 1000));
      setTimerSeconds(elapsed);
    }, 1000);
  }, [timerRunning, timerSeconds]);

  const pauseTimer = useCallback(() => {
    if (!timerRunning) return;
    clearTimerInterval();
    setTimerRunning(false);
    applyTimerToDuration(timerSeconds);
  }, [timerRunning, clearTimerInterval, applyTimerToDuration, timerSeconds]);

  const resetTimer = useCallback(() => {
    clearTimerInterval();
    setTimerRunning(false);
    setTimerSeconds(0);
    startTimestampRef.current = null;
  }, [clearTimerInterval]);

  useEffect(() => {
    return () => {
      clearTimerInterval();
    };
  }, [clearTimerInterval]);

  useEffect(() => {
    if (timerRunning) {
      applyTimerToDuration(timerSeconds);
    }
  }, [timerRunning, timerSeconds, applyTimerToDuration]);

  const handleSubmit = async () => {
    if (!formValues.moduleId || !formValues.timestamp) {
      notifications.show({
        title: "Bitte prüfen",
        message: "Ordner, Modul und Datum müssen ausgewählt sein.",
        color: "red",
      });
      return;
    }
    if (formValues.durationHours <= 0) {
      notifications.show({
        title: "Dauer fehlt",
        message: "Bitte trage eine Dauer in Stunden ein.",
        color: "red",
      });
      return;
    }
    setSubmitting(true);
    try {
      const timestamp = dayjs(formValues.timestamp).format("YYYY-MM-DD");
      await addEntry({
        moduleId: formValues.moduleId,
        activityType: formValues.activityType.trim() || "Aktivität",
        description: formValues.description.trim() || undefined,
        durationHours: formValues.durationHours,
        timestamp,
      });
      notifications.show({
        title: "Eintrag gespeichert",
        message: "Deine Lernzeit wurde erfasst.",
        color: "green",
      });
      setFormValues(() => ({
        ...initialFormValues,
        timestamp: new Date(),
        activityType: "",
        description: "",
        durationHours: initialFormValues.durationHours,
      }));
      resetTimer();
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Eintrag konnte nicht gespeichert werden.";
      notifications.show({
        title: "Fehler",
        message,
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formattedTimer = useMemo(() => {
    const hours = Math.floor(timerSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((timerSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(timerSeconds % 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [timerSeconds]);

  return (
    <Stack gap="md">
      <Select
        label="Ordner"
        data={folderOptions}
        value={formValues.folderId}
        onChange={handleFolderChange}
        placeholder="Ordner wählen"
        required
      />

      <Select
        label="Modul / Projekt"
        data={moduleOptions}
        value={formValues.moduleId}
        onChange={handleModuleChange}
        searchable
        nothingFoundMessage="Kein Modul gefunden"
        required
      />

      <Group grow>
        <TextInput
          label="Tätigkeit"
          placeholder="z. B. App Entwicklung"
          value={formValues.activityType}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            setFormValues((prev) => ({ ...prev, activityType: nextValue }));
          }}
          required
        />
        <NumberInput
          label="Dauer in Stunden"
          value={formValues.durationHours}
          onChange={(value) =>
            setFormValues((prev) => ({ ...prev, durationHours: Number(value) || 0 }))
          }
          min={0.25}
          step={0.25}
          clampBehavior="strict"
          disabled={timerRunning}
          required
        />
      </Group>

      <Paper withBorder radius="md" p="md" bg="var(--mantine-color-body)">
        <Group justify="space-between" align="center">
          <Stack gap={2} align="flex-start">
            <Text size="xs" c="dimmed">
              Timer
            </Text>
            <Text size="lg" fw={600} ff="monospace">
              {formattedTimer}
            </Text>
          </Stack>
          <Group gap="xs">
            {timerRunning ? (
              <Tooltip label="Pause">
                <ActionIcon
                  variant="subtle"
                  radius="xl"
                  size="lg"
                  onClick={pauseTimer}
                  aria-label="Timer pausieren"
                >
                  <IconPlayerPause size={16} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Tooltip label="Start">
                <ActionIcon
                  variant="subtle"
                  radius="xl"
                  size="lg"
                  onClick={startTimer}
                  aria-label="Timer starten"
                >
                  <IconPlayerPlay size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Zurücksetzen">
              <ActionIcon
                variant="subtle"
                radius="xl"
                size="lg"
                onClick={resetTimer}
                aria-label="Timer Zurücksetzen"
                disabled={timerSeconds === 0 && !timerRunning}
              >
                <IconRotateClockwise size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Dauer übernehmen">
              <ActionIcon
                variant="subtle"
                radius="xl"
                size="lg"
                onClick={() => applyTimerToDuration(timerSeconds)}
                aria-label="Zeit in Stundenfeld übernehmen"
                disabled={timerSeconds === 0}
              >
                <IconClockCheck size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <Text size="xs" c="dimmed" mt="sm">
          Timer stoppen oder übernehmen, um die Dauer zu fixieren. Manuelle Eingabe ist moeglich, sobald der Timer
          pausiert ist.
        </Text>
      </Paper>

      <DateInput
        label="Datum"
        value={formValues.timestamp}
        onChange={(value) => setFormValues((prev) => ({ ...prev, timestamp: value }))}
        required
        locale="de"
      />

      <Textarea
        label="Notizen"
        placeholder="Details oder Reflektionen"
        minRows={3}
        value={formValues.description}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setFormValues((prev) => ({ ...prev, description: nextValue }));
        }}
      />

      <Group justify="flex-end">
        <Button
          size="md"
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting}
          leftSection={<IconClockPlay size={16} />}
        >
          Speichern
        </Button>
      </Group>
    </Stack>
  );
}





