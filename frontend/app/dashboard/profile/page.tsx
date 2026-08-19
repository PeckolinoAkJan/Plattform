'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import ScrollReveal from '../../../components/marketing/scroll-reveal';
import { getCurrentUser, updateCurrentUser, type UserProfile } from '../../../lib/api';

const EMPTY_PROFILE: UserProfile = {
  id: '',
  email: null,
  displayName: '',
  avatarUrl: null,
  isPremium: false,
  globalRoles: [],
  companyId: null,
  companyRole: null,
  profileVisibility: 'private',
  createdAt: '',
  updatedAt: '',
  stats: {
    totalDistance: 0,
    totalDeliveries: 0,
  },
};

export default function DashboardProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftProfileVisibility, setDraftProfileVisibility] = useState('private');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await getCurrentUser();
        if (!mounted) return;

        setProfile(next);
        setDraftDisplayName(next.displayName ?? '');
        setDraftEmail(next.email ?? '');
        setDraftProfileVisibility(next.profileVisibility ?? 'private');
      } catch {
        setMessage('Profil konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };

    load();

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
      setMessage('Profil erfolgreich gespeichert.');
    } catch {
      setMessage('Speichern fehlgeschlagen. Bitte prüfe die Daten.');
    } finally {
      setSaving(false);
    }
  };

  const initials = profile.displayName
    ? profile.displayName
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase())
        .slice(0, 2)
        .join('')
    : 'U';

  return (
    <main className="space-y-4">
      <ScrollReveal>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300">Nutzerprofil</p>
          <h1 className="text-3xl font-semibold text-white">Profil</h1>
          <p className="mt-2 text-sm text-gold-100/85">Passe deinen Account und Datenschutz-Einstellungen direkt an.</p>
        </div>
      </ScrollReveal>

      {message ? (
        <ScrollReveal>
          <p className="rounded-md border border-gold-700/50 bg-ink-900/80 px-3 py-2 text-sm text-gold-100/90">{message}</p>
        </ScrollReveal>
      ) : null}

      {loading ? (
        <ScrollReveal>
          <div className="rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5 text-sm text-gold-100/75">Profil wird geladen…</div>
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
                      alt={profile.displayName || 'Avatar'}
                      width={64}
                      height={64}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gold-300">Rolle</p>
                  <p className="text-lg text-white">{(profile.globalRoles?.[0] ?? 'Nutzer').toString()}</p>
                  <p className="text-sm text-gold-200/85">
                    Unternehmen: {typeof profile.company === 'string' ? profile.company : profile.company?.name || 'keine'}
                  </p>
                </div>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delayMs={100}>
            <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5">
              <h2 className="text-sm uppercase tracking-[0.3em] text-gold-200">Kontodaten</h2>

              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">Anzeigename</span>
                <input
                  value={draftDisplayName}
                  onChange={(event) => setDraftDisplayName(event.currentTarget.value)}
                  className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                  placeholder="Dein Anzeigename"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">E-Mail</span>
                <input
                  value={draftEmail}
                  onChange={(event) => setDraftEmail(event.currentTarget.value)}
                  type="email"
                  className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                  placeholder="user@company.com"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">Privatsphäre</span>
                <select
                  value={draftProfileVisibility}
                  onChange={(event) => setDraftProfileVisibility(event.currentTarget.value)}
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
                {saving ? 'Speichern…' : 'Profil speichern'}
              </button>
            </form>
          </ScrollReveal>
        </>
      ) : null}
    </main>
  );
}
