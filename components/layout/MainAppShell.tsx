"use client";

import {
  ActionIcon,
  Affix,
  AppShell,
  Box,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconCategory,
  IconDoorExit,
  IconLayoutDashboard,
  IconHourglassHigh,
  IconMoon,
  IconSun,
  IconTable,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
  { label: "Zeiterfassung", href: "/entries", icon: IconTable },
  { label: "Timer", href: "/timer", icon: IconHourglassHigh },
  { label: "Struktur", href: "/structure", icon: IconCategory },
];

function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const Icon = colorScheme === "dark" ? IconSun : IconMoon;
  return (
    <ActionIcon
      size="lg"
      variant="outline"
      radius="md"
      aria-label="Farbschema wechseln"
      onClick={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")}
    >
      <Icon size={18} stroke={1.5} />
    </ActionIcon>
  );
}

export function MainAppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { folderTree, totalTrackedHours } = useTimeTracking();
  const { user, loading: authLoading, signOut } = useAuth();
  const isMobile = useMediaQuery("(max-width: 48em)");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <Center mih="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <AppShell
      layout="alt"
      header={{ height: 64, collapsed: false }}
      padding={isMobile ? "md" : "lg"}
      footer={isMobile ? { height: 76 } : undefined}
    >
      <AppShell.Header withBorder bg="var(--mantine-color-body)">
        <Group h="100%" px={isMobile ? "md" : "lg"} justify="space-between">
          <Stack gap={2}>
            <Group gap="sm">
            <IconHourglassHigh size={22} stroke={1.5} />
              <Title order={4} fw={600}>
                Zeitmanagement
              </Title>
            </Group>
            {isMobile ? (
              <Text size="xs" c="dimmed">
                {totalTrackedHours.toFixed(1)} h erfasst
              </Text>
            ) : null}
          </Stack>
          <Group gap="sm" wrap="nowrap">
            {!isMobile ? (
              <Text size="sm" c="dimmed">
                {totalTrackedHours.toFixed(1)} h erfasst
              </Text>
            ) : null}
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main
        style={{
          marginLeft: isMobile ? 0 : 88,
          transition: "margin 150ms ease",
          paddingBottom: isMobile ? 96 : undefined,
        }}
      >
        {children}
      </AppShell.Main>

      {!isMobile ? (
        <AffixNav
          pathname={pathname}
          folderTreeInitials={folderTree.slice(0, 3).map((folder) => ({
            id: folder.id,
            name: folder.name,
            hours: folder.totalHours,
            href: `/entries?folder=${folder.id}`,
          }))}
          onSignOut={() =>
            signOut().catch((error) => {
              console.error("[Zeitmanagement] Logout fehlgeschlagen", error);
            })
          }
        />
      ) : (
        <BottomNav
          pathname={pathname}
          onSignOut={() =>
            signOut().catch((error) => {
              console.error("[Zeitmanagement] Logout fehlgeschlagen", error);
            })
          }
        />
      )}
    </AppShell>
  );
}

function AffixNav({
  pathname,
  folderTreeInitials,
  onSignOut,
}: {
  pathname: string;
  folderTreeInitials: { id: string; name: string; hours: number; href: string }[];
  onSignOut: () => void;
}) {
  return (
    <Affix position={{ top: "50%", left: 24 }} style={{ transform: "translateY(-50%)" }}>
      <Paper shadow="lg" radius="xl" withBorder p={8} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Stack gap={10} align="center">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Tooltip key={href} label={label} position="right" offset={6} withinPortal>
                <ActionIcon
                  component={Link}
                  href={href}
                  variant={active ? "filled" : "subtle"}
                  color={active ? "indigo" : "gray"}
                  size={48}
                  radius="xl"
                  aria-label={label}
                >
                  <Icon size={20} />
                </ActionIcon>
              </Tooltip>
            );
          })}
        </Stack>
        <Stack gap={6} align="center" mt="md">
          {folderTreeInitials.map((folder) => (
            <Tooltip
              key={folder.id}
              label={`${folder.name} (${folder.hours.toFixed(1)} h)`}
              position="right"
              withinPortal
            >
              <ActionIcon
                component={Link}
                href={folder.href}
                variant="light"
                color="gray"
                size={36}
                radius="xl"
                aria-label={`Zeiterfassung ${folder.name}`}
              >
                <Text size="sm" fw={600}>
                  {folder.name.charAt(0).toUpperCase()}
                </Text>
              </ActionIcon>
            </Tooltip>
          ))}
        </Stack>
        <Tooltip label="Logout" position="right" withinPortal>
          <ActionIcon variant="subtle" color="gray" radius="xl" size={44} aria-label="Logout" onClick={onSignOut}>
            <IconDoorExit size={20} />
          </ActionIcon>
        </Tooltip>
      </Paper>
    </Affix>
  );
}

function BottomNav({ pathname, onSignOut }: { pathname: string; onSignOut: () => void }) {
  return (
    <AppShell.Footer withBorder bg="var(--mantine-color-body)">
      <Group justify="space-between" px="xl" py="sm">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Box key={href} component={Link} href={href} style={{ textDecoration: "none" }}>
              <Stack gap={2} align="center" justify="center" style={{ minWidth: 64 }}>
                <ActionIcon
                  size="lg"
                  radius="xl"
                  variant={active ? "filled" : "subtle"}
                  color={active ? "indigo" : "gray"}
                  aria-label={label}
                >
                  <Icon size={20} />
                </ActionIcon>
                <Text size="xs" c={active ? "indigo" : "dimmed"} fw={active ? 600 : 500}>
                  {label}
                </Text>
              </Stack>
            </Box>
          );
        })}
        <Stack gap={2} align="center" justify="center" style={{ minWidth: 64 }}>
          <ActionIcon size="lg" radius="xl" variant="subtle" color="gray" aria-label="Logout" onClick={onSignOut}>
            <IconDoorExit size={20} />
          </ActionIcon>
          <Text size="xs" c="dimmed" fw={500}>
            Logout
          </Text>
        </Stack>
      </Group>
    </AppShell.Footer>
  );
}
