"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Anchor,
  Button,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../contexts/AuthContext";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, initialized, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const actionLabel = mode === "login" ? "Anmelden" : "Registrieren";
  const toggleLabel = mode === "login" ? "Noch kein Konto? Jetzt registrieren" : "Bereits registriert? Hier anmelden";

  useEffect(() => {
    if (!loading && initialized && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, initialized, router]);

  const isDisabled = useMemo(() => {
    if (submitting) return true;
    if (!email || !password) return true;
    if (mode === "register" && !displayName.trim()) return true;
    return false;
  }, [submitting, email, password, mode, displayName]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDisabled) return;
    setSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (!error) {
          notifications.show({
            title: "Willkommen zurueck",
            message: "Du wurdest erfolgreich angemeldet.",
            color: "green",
          });
          router.replace("/dashboard");
        }
      } else {
        const { error } = await signUp(email, password, displayName.trim());
        if (!error) {
          notifications.show({
            title: "Registrierung abgeschlossen",
            message: "Bitte pruefe dein Postfach und bestaetige deine E-Mail.",
            color: "green",
          });
          setMode("login");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !initialized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <Paper radius="lg" withBorder p="xl" maw={420} style={{ width: "100%" }}>
        <form onSubmit={handleSubmit}>
          <Stack>
            <Stack gap={4}>
              <Title order={2}>{mode === "login" ? "Willkommen zurueck" : "Neues Konto erstellen"}</Title>
              <Text c="dimmed" size="sm">
                {mode === "login"
                  ? "Melde dich mit deinem Supabase-Konto an, um deine Daten zu synchronisieren."
                  : "Lege ein neues Konto für dein Zeitmanagement an."}
              </Text>
            </Stack>

            <TextInput
              label="E-Mail"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              autoComplete="email"
            />

            {mode === "register" ? (
              <TextInput
                label="Anzeigename"
                placeholder="Wie sollen wir dich nennen?"
                value={displayName}
                onChange={(event) => setDisplayName(event.currentTarget.value)}
                required
              />
            ) : null}

            <PasswordInput
              label="Passwort"
              placeholder="Mindestens 6 Zeichen"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            <Button type="submit" size="md" loading={submitting} disabled={isDisabled}>
              {actionLabel}
            </Button>

            <Anchor
              component="button"
              type="button"
              size="sm"
              c="indigo.6"
              onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
            >
              {toggleLabel}
            </Anchor>
          </Stack>
        </form>
      </Paper>
    </div>
  );
}



