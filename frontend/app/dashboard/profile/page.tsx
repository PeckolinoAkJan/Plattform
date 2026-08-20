"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import ScrollReveal from "../../../components/marketing/scroll-reveal";
import {
  getAuthProviders,
  getCurrentUser,
  getProviderLinkUrl,
  setCurrentUserPassword,
  updateCurrentUser,
  type AuthProviders,
  type UserProfile,
} from "../../../lib/api";

const EMPTY_PROFILE: UserProfile = {
  id: "",
  email: null,
  displayName: "",
  avatarUrl: null,
  isPremium: false,
  globalRoles: [],
  companyId: null,
  companyRole: null,
  profileVisibility: "private",
  passwordConfigured: false,
  createdAt: "",
  updatedAt: "",
  stats: {
    totalDistance: 0,
    totalDeliveries: 0,
  },
};

export default function DashboardProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftProfileVisibility, setDraftProfileVisibility] =
    useState("private");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [providers, setProviders] = useState<AuthProviders>({
    google: false,
    discord: false,
    steam: false,
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [next, availableProviders] = await Promise.all([
          getCurrentUser(),
          getAuthProviders(),
        ]);
        if (!mounted) return;

        setProfile(next);
        setProviders(availableProviders);
        setDraftDisplayName(next.displayName ?? "");
        setDraftEmail(next.email ?? "");
        setDraftProfileVisibility(next.profileVisibility ?? "private");
      } catch {
        setMessage("Profil konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };

    load();

    const linkedProvider = new URLSearchParams(window.location.search).get(
      "linked",
    );
    if (linkedProvider)
      setMessage(
        `${linkedProvider} wurde erfolgreich mit deinem Konto verknüpft.`,
      );

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const next = await updateCurrentUser({
        displayName: draftDisplayName.trim(),
        email: draftEmail.trim(),
        profileVisibility: draftProfileVisibility,
      });

      setProfile(next);
      setMessage("Profil erfolgreich gespeichert.");
    } catch {
      setMessage("Speichern fehlgeschlagen. Bitte prüfe die Daten.");
    } finally {
      setSaving(false);
    }
  };

  const initials = profile.displayName
    ? profile.displayName
        .trim()
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase())
        .slice(0, 2)
        .join("")
    : "U";

  const onPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    setPasswordSaving(true);
    setMessage(null);
    try {
      await setCurrentUserPassword({
        currentPassword: profile.passwordConfigured
          ? currentPassword
          : undefined,
        newPassword,
      });
      setProfile((current) => ({ ...current, passwordConfigured: true }));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(
        "Normaler Login mit E-Mail und Passwort ist jetzt eingerichtet.",
      );
    } catch {
      setMessage(
        "Passwort konnte nicht gespeichert werden. Prüfe das aktuelle Passwort und die Mindestlänge von 10 Zeichen.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <main className="space-y-4">
      <ScrollReveal>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300">
            Nutzerprofil
          </p>
          <h1 className="text-3xl font-semibold text-white">Profil</h1>
          <p className="mt-2 text-sm text-gold-100/85">
            Passe deinen Account und Datenschutz-Einstellungen direkt an.
          </p>
        </div>
      </ScrollReveal>

      {message ? (
        <ScrollReveal>
          <p className="rounded-md border border-gold-700/50 bg-ink-900/80 px-3 py-2 text-sm text-gold-100/90">
            {message}
          </p>
        </ScrollReveal>
      ) : null}

      {loading ? (
        <ScrollReveal>
          <div className="rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5 text-sm text-gold-100/75">
            Profil wird geladen…
          </div>
        </ScrollReveal>
      ) : null}

      {!loading ? (
        <>
          <ScrollReveal delayMs={60}>
            <section className="rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-xl border border-gold-700/60 bg-ink-950 text-lg text-gold-100">
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.displayName || "Avatar"}
                      width={64}
                      height={64}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gold-300">
                    Rolle
                  </p>
                  <p className="text-lg text-white">
                    {(profile.globalRoles?.[0] ?? "Nutzer").toString()}
                  </p>
                  <p className="text-sm text-gold-200/85">
                    Unternehmen:{" "}
                    {typeof profile.company === "string"
                      ? profile.company
                      : profile.company?.name || "keine"}
                  </p>
                </div>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delayMs={100}>
            <form
              onSubmit={onSubmit}
              className="grid gap-3 rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5"
            >
              <h2 className="text-sm uppercase tracking-[0.3em] text-gold-200">
                Kontodaten
              </h2>

              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">
                  Anzeigename
                </span>
                <input
                  value={draftDisplayName}
                  onChange={(event) =>
                    setDraftDisplayName(event.currentTarget.value)
                  }
                  className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                  placeholder="Dein Anzeigename"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">
                  E-Mail
                </span>
                <input
                  value={draftEmail}
                  onChange={(event) => setDraftEmail(event.currentTarget.value)}
                  type="email"
                  className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                  placeholder="user@company.com"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">
                  Privatsphäre
                </span>
                <select
                  value={draftProfileVisibility}
                  onChange={(event) =>
                    setDraftProfileVisibility(event.currentTarget.value)
                  }
                  className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                >
                  <option value="private">Privat</option>
                  <option value="public">Öffentlich</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="mt-1 inline-flex min-h-11 items-center rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 disabled:opacity-65"
              >
                {saving ? "Speichern…" : "Profil speichern"}
              </button>
            </form>
          </ScrollReveal>

          <ScrollReveal delayMs={130}>
            <section className="grid gap-4 rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5">
              <div>
                <h2 className="text-sm uppercase tracking-[0.3em] text-gold-200">
                  Verknüpfte Konten
                </h2>
                <p className="mt-2 text-sm text-gold-100/75">
                  Verbinde weitere Anmeldemethoden mit diesem VTC-Hub-Konto.
                  Bereits verknüpfte Konten bleiben erhalten.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["google", "discord", "steam"] as const).map((provider) => {
                  const connected =
                    profile.connectedAccounts?.some(
                      (account) => account.provider === provider,
                    ) ?? false;
                  const available = providers[provider];
                  const label =
                    provider === "google"
                      ? "Google"
                      : provider === "discord"
                        ? "Discord"
                        : "Steam";
                  if (connected || !available) {
                    return (
                      <button
                        key={provider}
                        type="button"
                        disabled
                        className="min-h-11 rounded-xl border border-gold-800/45 bg-ink-950/55 px-4 py-3 text-sm text-gold-100/55"
                      >
                        {label}:{" "}
                        {connected ? "verknüpft" : "noch nicht konfiguriert"}
                      </button>
                    );
                  }
                  return (
                    <a
                      key={provider}
                      href={getProviderLinkUrl(provider)}
                      className="interactive-focus inline-flex min-h-11 items-center justify-center rounded-xl border border-gold-500/45 bg-gold-500/15 px-4 py-3 text-sm font-semibold text-gold-100 transition hover:bg-gold-500/25"
                    >
                      {label} verknüpfen
                    </a>
                  );
                })}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delayMs={160}>
            <form
              onSubmit={onPasswordSubmit}
              className="grid gap-3 rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5"
            >
              <h2 className="text-sm uppercase tracking-[0.3em] text-gold-200">
                Normaler Login
              </h2>
              <p className="text-sm text-gold-100/75">
                {profile.passwordConfigured
                  ? "Ändere dein Passwort für den Login mit E-Mail und Passwort."
                  : "Lege ein Passwort an, um dich zusätzlich ohne OAuth-Anbieter anmelden zu können."}
              </p>
              {profile.passwordConfigured ? (
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.currentTarget.value)
                  }
                  placeholder="Aktuelles Passwort"
                  className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                />
              ) : null}
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
                placeholder="Neues Passwort (mindestens 10 Zeichen)"
                className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
              />
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.currentTarget.value)
                }
                placeholder="Neues Passwort wiederholen"
                className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 disabled:opacity-65"
              >
                {passwordSaving
                  ? "Speichern…"
                  : profile.passwordConfigured
                    ? "Passwort ändern"
                    : "Normalen Login aktivieren"}
              </button>
            </form>
          </ScrollReveal>
        </>
      ) : null}
    </main>
  );
}
