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
import { IconClockPlay, IconPlayerPause, IconPlayerPlay, IconRotateClockwise } from "@tabler/icons-react";
import type { TimeEntry } from "../../types/time";

type EntryFormValues = {
  folderId: string;
  moduleId: string;
  activityType: string;
  description: string;
  durationHours: number;
  timestamp: Date | null;
};

type EntryFormProps = {
  onSuccess?: () => void;
  entry?: TimeEntry | null;
};

const DECIMAL_FORMATTER = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pad = (value: number) => value.toString().padStart(2, "0");

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export function EntryForm({ onSuccess, entry }: EntryFormProps) {
  const { modulesWithRelations, flattenedFolders, addEntry, updateEntry } = useTimeTracking();

  const moduleMap = useMemo(() => new Map(modulesWithRelations.map((module) => [module.id, module])), [modulesWithRelations]);

  const isEditMode = Boolean(entry);

  const initialFormValues = useMemo<EntryFormValues>(() => {
    if (entry) {
      const entryModule = modulesWithRelations.find((module) => module.id === entry.moduleId);
      const fallbackModule = modulesWithRelations[0];
      const fallbackFolder = flattenedFolders[0];
      const resolvedModule = entryModule ?? fallbackModule ?? null;
      const resolvedFolderId = resolvedModule?.folderId ?? fallbackFolder?.id ?? "";
      return {
        folderId: resolvedFolderId,
        moduleId: resolvedModule?.id ?? "",
        activityType: entry.activityType,
        description: entry.description ?? "",
        durationHours: entry.durationHours,
        timestamp: entry.timestamp ? dayjs(entry.timestamp).toDate() : new Date(),
      };
    }

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
  }, [entry, modulesWithRelations, flattenedFolders]);

  const [formValues, setFormValues] = useState<EntryFormValues>(initialFormValues);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    setFormValues(initialFormValues);
    if (isEditMode) {
      setTimerSeconds(0);
      setTimerRunning(false);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [initialFormValues, isEditMode]);

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

  const convertSecondsToHours = useCallback((seconds: number) => Math.round((seconds / 3600) * 100) / 100, []);

  const applyTimerToDuration = useCallback(
    (seconds: number) => {
      const hours = convertSecondsToHours(seconds);
      setFormValues((prev) => (prev.durationHours === hours ? prev : { ...prev, durationHours: hours }));
    },
    [convertSecondsToHours],
  );

  const startTimer = useCallback(() => {
    if (isEditMode || timerRunning) return;
    if (typeof window === "undefined") return;
    setTimerRunning(true);
    startTimestampRef.current = Date.now() - timerSeconds * 1000;
    intervalRef.current = window.setInterval(() => {
      if (!startTimestampRef.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startTimestampRef.current) / 1000));
      setTimerSeconds(elapsed);
    }, 1000);
  }, [isEditMode, timerRunning, timerSeconds]);

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

  useEffect(() => () => clearTimerInterval(), [clearTimerInterval]);

  useEffect(() => {
    if (timerRunning) {
      applyTimerToDuration(timerSeconds);
    }
  }, [timerRunning, timerSeconds, applyTimerToDuration]);

  const formattedTimer = useMemo(() => formatElapsed(timerSeconds), [timerSeconds]);
  const timerSegments = useMemo(() => formattedTimer.split(":"), [formattedTimer]);
  const decimalHours = useMemo(() => timerSeconds / 3600, [timerSeconds]);
  const decimalFormatted = useMemo(() => DECIMAL_FORMATTER.format(decimalHours), [decimalHours]);

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
      const payload = {
        moduleId: formValues.moduleId,
        activityType: formValues.activityType.trim() || "Aktivität",
        description: formValues.description.trim() || undefined,
        durationHours: formValues.durationHours,
        timestamp: dayjs(formValues.timestamp).format("YYYY-MM-DD"),
      };

      if (isEditMode && entry) {
        await updateEntry(entry.id, payload);
        notifications.show({
          title: "Eintrag aktualisiert",
          message: "Die Lernzeit wurde aktualisiert.",
          color: "green",
        });
        onSuccess?.();
      } else {
        await addEntry(payload);
        notifications.show({
          title: "Eintrag gespeichert",
          message: "Deine Lernzeit wurde erfasst.",
          color: "green",
        });
        setFormValues((prev) => ({
          ...prev,
          activityType: "",
          description: "",
          durationHours: 1,
          timestamp: new Date(),
        }));
        resetTimer();
        onSuccess?.();
      }
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

  return (
    <Stack gap="md">
      {!isEditMode ? (
        <>
          <Group gap="md" align="center" justify="center" wrap="wrap">
            {timerSegments.map((segment, index) => (
              <Group key={`${segment}-${index}`} gap="sm" align="center">
                <Paper
                  withBorder
                  radius={18}
                  p="xl"
                  style={{
                    width: "clamp(85px, 18vw, 120px)",
                    height: "clamp(110px, 20vw, 160px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    component="span"
                    style={{
                      fontFamily: "monospace",
                      fontSize: "clamp(2.8rem, 6vw, 4.6rem)",
                      fontWeight: 700,
                    }}
                  >
                    {segment}
                  </Text>
                </Paper>
                {index < timerSegments.length - 1 ? (
                  <Text
                    ff="monospace"
                    fw={700}
                    style={{
                      fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
                      lineHeight: 1,
                      transform: "translateY(-4px)",
                    }}
                  >
                    :
                  </Text>
                ) : null}
              </Group>
            ))}
          </Group>

          <Stack gap={12} align="center">
            <Group gap="md">
              {timerRunning ? (
                <Tooltip label="Pause">
                  <ActionIcon size="lg" radius="xl" variant="filled" color="blue" onClick={pauseTimer} aria-label="Timer pausieren">
                    <IconPlayerPause size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Tooltip label={timerSeconds === 0 ? "Start" : "Fortsetzen"}>
                  <ActionIcon size="lg" radius="xl" variant="filled" color="green" onClick={startTimer} aria-label="Timer starten">
                    <IconPlayerPlay size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="Zurücksetzen">
                <ActionIcon
                  size="lg"
                  radius="xl"
                  variant="light"
                  color="gray"
                  onClick={resetTimer}
                  aria-label="Timer zurücksetzen"
                  disabled={timerSeconds === 0 && !timerRunning}
                >
                  <IconRotateClockwise size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Dauer übernehmen">
                <ActionIcon
                  size="lg"
                  radius="xl"
                  variant="light"
                  color="gray"
                  onClick={() => applyTimerToDuration(timerSeconds)}
                  aria-label="Zeit in Formular übernehmen"
                  disabled={timerSeconds === 0}
                >
                  <IconClockPlay size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Text size="sm" c="dimmed">
              {decimalFormatted} Std
            </Text>
          </Stack>
        </>
      ) : null}

      <Paper withBorder radius="md" p="md" bg="var(--mantine-color-body)">
        <Stack gap="md">
          <Select
            label="Ordner"
            placeholder="Ordner wählen"
            data={folderOptions}
            value={formValues.folderId}
            onChange={handleFolderChange}
            required
          />
          <Select
            label="Projekt"
            placeholder="Projekt wählen"
            data={moduleOptions}
            value={formValues.moduleId}
            onChange={handleModuleChange}
            required
          />
          <Group grow align="flex-end">
            <TextInput
              label="Tätigkeit"
              placeholder="z. B. App Entwicklung"
              value={formValues.activityType}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFormValues((prev) => ({ ...prev, activityType: value }));
              }}
              required
            />
            <NumberInput
              label="Dauer in Stunden"
              value={formValues.durationHours}
              onChange={(value) => setFormValues((prev) => ({ ...prev, durationHours: Number(value) || 0 }))}
              min={0.25}
              step={0.25}
              clampBehavior="strict"
              required
            />
          </Group>
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
              const value = event.currentTarget.value;
              setFormValues((prev) => ({ ...prev, description: value }));
            }}
          />
          <Group justify="flex-end">
            <Button size="md" onClick={handleSubmit} loading={submitting} leftSection={<IconClockPlay size={16} />}>
              {isEditMode ? "Änderungen speichern" : "Speichern"}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
