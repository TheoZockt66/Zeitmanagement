import type { Metadata, Viewport } from "next";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "dayjs/locale/de";
import "./globals.css";
import { ColorSchemeScript } from "@mantine/core";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Zeitmanagement",
  description: "Zeiterfassung fuer Studium, Freizeit und persoenliche Projekte",
  robots: {
    index: false,
  },
  keywords: ["Zeitmanagement", "Zeiterfassung", "Studium"],
  icons: {
    icon: "/hourglass-high.svg",
    shortcut: "/hourglass-high.svg",
    apple: "/hourglass-high.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1b1e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
