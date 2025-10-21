"use client";

import { MantineProvider, localStorageColorSchemeManager } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { TimeTrackingProvider } from "../contexts/TimeTrackingContext";
import { AuthProvider } from "../contexts/AuthContext";

const colorSchemeManager = typeof window !== "undefined" ? localStorageColorSchemeManager({ key: "zeitmanagement-color-scheme" }) : undefined;

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      defaultColorScheme="light"
      colorSchemeManager={colorSchemeManager}
      theme={{
        primaryColor: "indigo",
        primaryShade: { light: 5, dark: 7 },
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        headings: {
          fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        },
        defaultRadius: "md",
        components: {
          Card: {
            defaultProps: { withBorder: true },
          },
          Paper: {
            defaultProps: { withBorder: true },
          },
        },
        breakpoints: {
          xs: "30em",
          sm: "48em",
          md: "62em",
          lg: "75em",
          xl: "88em",
        },
      }}
    >
      <DatesProvider settings={{ locale: "de", firstDayOfWeek: 1 }}>
        <AuthProvider>
          <TimeTrackingProvider>
            {children}
            <Notifications position="top-center" limit={3} />
          </TimeTrackingProvider>
        </AuthProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
