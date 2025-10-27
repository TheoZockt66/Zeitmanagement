"use client";

import {
  ActionIcon,
  Box,
  Flex,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  Tooltip,
  useMantineTheme,
  useComputedColorScheme,
} from "@mantine/core";
import { IconPlayerPause, IconPlayerPlay, IconRotateClockwise } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DECIMAL_FORMATTER = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DEFAULT_TIMER_MINUTES = 25;

const pad = (value: number) => value.toString().padStart(2, "0");

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export default function TimerPageContent() {
  const [mode, setMode] = useState<"stopwatch" | "timer">("stopwatch");
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [timerDurationSeconds, setTimerDurationSeconds] = useState(DEFAULT_TIMER_MINUTES * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_TIMER_MINUTES * 60);
  const [running, setRunning] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const targetEndRef = useRef<number | null>(null);

  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = colorScheme === "dark";

  const displaySeconds = mode === "stopwatch" ? stopwatchSeconds : remainingSeconds;
  const decimalHours = useMemo(() => displaySeconds / 3600, [displaySeconds]);
  const decimalFormatted = useMemo(() => DECIMAL_FORMATTER.format(decimalHours), [decimalHours]);
  const formattedTimer = useMemo(() => formatElapsed(displaySeconds), [displaySeconds]);

  const clearIntervalRef = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleDurationChange = useCallback(
    (value: string | number | null) => {
      if (value === null || value === "") {
        return;
      }
      const numericValue = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(numericValue)) {
        return;
      }
      const minutes = Math.min(720, Math.max(1, numericValue));
      const secondsValue = Math.round(minutes * 60);
      setTimerDurationSeconds(secondsValue);
      if (!running) {
        setRemainingSeconds(secondsValue);
      }
    },
    [running],
  );

  const startTimer = useCallback(() => {
    if (running) return;

    if (mode === "stopwatch") {
      startTimestampRef.current = Date.now() - stopwatchSeconds * 1000;
    } else {
      const baseline = remainingSeconds > 0 ? remainingSeconds : timerDurationSeconds;
      setRemainingSeconds(baseline);
      targetEndRef.current = Date.now() + baseline * 1000;
    }

    setRunning(true);

    intervalRef.current = window.setInterval(() => {
      if (mode === "stopwatch") {
        if (!startTimestampRef.current) return;
        const elapsedMs = Date.now() - startTimestampRef.current;
        setStopwatchSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
      } else {
        if (!targetEndRef.current) return;
        const remaining = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
        setRemainingSeconds(remaining);
        if (remaining === 0) {
          clearIntervalRef();
          setRunning(false);
          targetEndRef.current = null;
        }
      }
    }, 1000);
  }, [running, mode, stopwatchSeconds, remainingSeconds, timerDurationSeconds, clearIntervalRef]);

  const pauseTimer = useCallback(() => {
    if (!running) return;
    clearIntervalRef();
    if (mode === "stopwatch") {
      if (startTimestampRef.current) {
        const elapsedMs = Date.now() - startTimestampRef.current;
        setStopwatchSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
      }
      startTimestampRef.current = null;
    } else {
      if (targetEndRef.current) {
        const remaining = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
        setRemainingSeconds(remaining);
      }
      targetEndRef.current = null;
    }
    setRunning(false);
  }, [running, mode, clearIntervalRef]);

  const resetTimer = useCallback(() => {
    clearIntervalRef();
    setRunning(false);
    if (mode === "stopwatch") {
      setStopwatchSeconds(0);
      startTimestampRef.current = null;
    } else {
      setRemainingSeconds(timerDurationSeconds);
      targetEndRef.current = null;
    }
  }, [clearIntervalRef, mode, timerDurationSeconds]);

  useEffect(() => {
    return () => {
      clearIntervalRef();
    };
  }, [clearIntervalRef]);

  useEffect(() => {
    clearIntervalRef();
    setRunning(false);
    startTimestampRef.current = null;
    targetEndRef.current = null;
    if (mode === "timer") {
      setRemainingSeconds((prev) => (prev > 0 ? prev : timerDurationSeconds));
    }
  }, [mode, timerDurationSeconds, clearIntervalRef]);

  useEffect(() => {
    if (mode === "timer" && !running) {
      setRemainingSeconds(timerDurationSeconds);
    }
  }, [timerDurationSeconds, mode, running]);

  const timerSegments = formattedTimer.split(":");
  const containerBackground = isDark ? theme.colors.dark?.[7] ?? "#101218" : theme.white ?? "#ffffff";
  const colonColor = isDark ? theme.colors.gray[3] : theme.colors.dark[5];
  const decimalTextColor = isDark ? theme.colors.gray[4] : theme.colors.gray[6];

  const resetDisabled =
    !running &&
    (mode === "stopwatch"
      ? stopwatchSeconds === 0
      : remainingSeconds === timerDurationSeconds);

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="xl"
      mih="80vh"
      px="xl"
      py="xl"
      style={{
        backgroundColor: containerBackground,
        transition: "background-color 160ms ease",
        position: "relative",
      }}
    >
      <Group gap="xs" align="center" style={{ alignSelf: "flex-end" }}>
        <Text size="sm" c="dimmed">
          {mode === "timer" ? "Timer" : "Stopuhr"}
        </Text>
        <Switch
          size="sm"
          color="indigo"
          checked={mode === "timer"}
          onChange={(event) => setMode(event.currentTarget.checked ? "timer" : "stopwatch")}
          aria-label="Timer-Modus umschalten"
        />
        {mode === "timer" ? (
          <NumberInput
            size="xs"
            maw={120}
            min={1}
            max={720}
            hideControls
            value={Math.round(timerDurationSeconds / 60)}
            onChange={handleDurationChange}
            aria-label="Timer-Dauer in Minuten"
            placeholder="Minuten"
          />
        ) : null}
      </Group>

      <Group gap="lg" align="center" justify="center" wrap="wrap">
        {timerSegments.map((segment, index) => (
          <Group key={`${segment}-${index}`} gap="sm" align="center">
            <FlipBlock value={segment} />
            {index < timerSegments.length - 1 && (
              <Text
                ff="monospace"
                fw={700}
                style={{
                  fontSize: "clamp(3rem, 6vw, 4.5rem)",
                  lineHeight: 1,
                  transform: "translateY(-6px)",
                  color: colonColor,
                }}
              >
                :
              </Text>
            )}
          </Group>
        ))}
      </Group>

      <Stack gap={12} align="center">
        <Group gap="md">
          {running ? (
            <Tooltip label="Pause">
              <ActionIcon
                size="lg"
                radius="xl"
                variant={isDark ? "filled" : "light"}
                color="blue"
                onClick={pauseTimer}
                aria-label="Timer pausieren"
              >
                <IconPlayerPause size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label={displaySeconds === 0 ? "Start" : "Fortsetzen"}>
              <ActionIcon
                size="lg"
                radius="xl"
                variant={isDark ? "filled" : "light"}
                color="green"
                onClick={startTimer}
                aria-label="Timer starten"
              >
                <IconPlayerPlay size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Zuruecksetzen">
            <ActionIcon
              size="lg"
              radius="xl"
              variant={isDark ? "subtle" : "light"}
              color="gray"
              onClick={resetTimer}
              aria-label="Timer zuruecksetzen"
              disabled={resetDisabled}
            >
              <IconRotateClockwise size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="sm" style={{ color: decimalTextColor }}>
          {mode === "timer" ? `${decimalFormatted} Std verbleibend` : `${decimalFormatted} Std`}
        </Text>
      </Stack>
    </Flex>
  );
}

function FlipBlock({ value }: { value: string }) {
  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = colorScheme === "dark";

  const blockBackground = isDark ? theme.colors.dark?.[6] ?? "#1f2127" : theme.white;
  const blockShadow = isDark
    ? "0 18px 42px rgba(0, 0, 0, 0.45)"
    : "0 18px 42px rgba(15, 23, 42, 0.16)";
  const seamColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const highlight = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)";
  const shadow = isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.08)";
  const textColor = isDark ? theme.colors.gray?.[1] ?? "#f8f9fa" : theme.colors.dark?.[6] ?? "#0b0c0f";

  return (
    <Box
      style={{
        position: "relative",
        borderRadius: 18,
        width: "clamp(110px, 22vw, 150px)",
        height: "clamp(140px, 26vw, 190px)",
        backgroundColor: blockBackground,
        boxShadow: blockShadow,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.18) 100%)",
          pointerEvents: "none",
        }}
      />
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          borderBottom: `1px solid ${highlight}`,
          pointerEvents: "none",
        }}
      />
      <Box
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "50%",
          borderTop: `1px solid ${shadow}`,
          pointerEvents: "none",
        }}
      />
      <Box
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          background: seamColor,
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      />
      <Text
        component="span"
        style={{
          fontFamily: "monospace",
          fontSize: "clamp(3.3rem, 7vw, 5.4rem)",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: textColor,
        }}
      >
        {value}
      </Text>
    </Box>
  );
}
