"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import ScrollReveal from "../../../components/marketing/scroll-reveal";
import { companyApi, type Company } from "../../../lib/api";

const EMPTY_COMPANY: Company = {
  id: "",
  name: "",
  tag: null,
  description: null,
  logoUrl: null,
  avatarUrl: null,
};

export default function CompanyPage() {
  const [company, setCompany] = useState<Company>(EMPTY_COMPANY);
  const [draftName, setDraftName] = useState("");
  const [draftTag, setDraftTag] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCountryCode, setDraftCountryCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "members" | "settings"
  >("overview");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await companyApi.get();
        if (!mounted) return;

        setCompany(next);
        setDraftName(next.name ?? "");
        setDraftTag(next.tag ?? "");
        setDraftDescription(next.description ?? "");
        setDraftCountryCode(
          (next as { countryCode?: string | null }).countryCode ?? "",
        );
      } catch {
        setMessage(
          "Aktuell ist noch keine Spedition zugeordnet oder kein Zugriff möglich.",
        );
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
      const payload: Partial<Company> = {
        name: draftName.trim(),
        tag: draftTag.trim() || undefined,
        description: draftDescription.trim() || undefined,
      };

      if (draftCountryCode.trim()) {
        (payload as { countryCode?: string }).countryCode = draftCountryCode
          .trim()
          .toUpperCase();
      }

      const next = await companyApi.update(payload);
      setCompany(next);
      setDraftName(next.name ?? "");
      setDraftTag(next.tag ?? "");
      setDraftDescription(next.description ?? "");
      setMessage("Speditionsdaten erfolgreich gespeichert.");
    } catch {
      setMessage("Speichern fehlgeschlagen. Bitte prüfe die Rechte und Werte.");
    } finally {
      setSaving(false);
    }
  };

  const companyInitial = company.name?.slice(0, 2).toUpperCase() ?? "SC";

  return (
    <main className="space-y-4">
      <ScrollReveal>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300">
            Organisation
          </p>
          <h1 className="text-3xl font-semibold text-white">Spedition</h1>
          <p className="mt-2 text-sm text-gold-100/85">
            Stammdaten der Spedition, Rollenprofile und Team-Zusammenhänge.
          </p>
        </div>
      </ScrollReveal>

      {loading ? (
        <ScrollReveal>
          <div className="rounded-2xl border border-gold-700/60 bg-ink-900/70 p-5 text-sm text-gold-100/75">
            Lade Speditionsdaten…
          </div>
        </ScrollReveal>
      ) : null}

      {!loading && (
        <>
          <ScrollReveal delayMs={40}>
            <nav
              className="flex flex-wrap gap-2 rounded-2xl border border-gold-700/50 bg-ink-900/70 p-2"
              aria-label="Speditionsbereiche"
            >
              {(
                [
                  ["overview", "Übersicht"],
                  ["members", `Mitglieder (${company.members?.length ?? 0})`],
                  ["settings", "Einstellungen"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveTab(value)}
                  className={`interactive-focus min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === value
                      ? "bg-gold-500 text-ink-950"
                      : "bg-ink-950/55 text-gold-100/80 hover:bg-gold-500/12 hover:text-gold-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </ScrollReveal>

          {message ? (
            <ScrollReveal>
              <p className="rounded-md border border-gold-700/50 bg-ink-900/80 px-3 py-2 text-sm text-gold-100/90">
                {message}
              </p>
            </ScrollReveal>
          ) : null}

          {activeTab === "overview" ? (
            <ScrollReveal delayMs={80}>
              <section className="rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5">
                <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-gold-700/45 pb-4">
                  <div className="grid h-16 w-16 place-items-center rounded-xl border border-gold-700/55 bg-ink-950 text-lg font-semibold text-gold-100">
                    {company.logoUrl ? (
                      <Image
                        src={company.logoUrl}
                        alt={company.name}
                        width={64}
                        height={64}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <span>{companyInitial}</span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-gold-300">
                      Aktive Spedition
                    </p>
                    <h2 className="text-xl font-semibold text-white">
                      {company.name || "Keine Spedition"}
                    </h2>
                    <p className="text-sm text-gold-200/85">
                      {company.tag || "—"}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gold-200/90">
                  {company.description || "Keine Beschreibung hinterlegt."}
                </p>
              </section>
            </ScrollReveal>
          ) : null}

          {activeTab === "members" ? (
            <ScrollReveal delayMs={80}>
              <section className="rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5">
                <h2 className="text-sm uppercase tracking-[0.3em] text-gold-200">
                  Team der Spedition
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(company.members ?? []).map((member) => (
                    <article
                      key={member.id}
                      className="rounded-xl border border-gold-800/50 bg-ink-950/60 p-4"
                    >
                      <p className="font-semibold text-white">
                        {member.displayName}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gold-300/80">
                        {member.companyRole ?? "Mitglied"}
                      </p>
                    </article>
                  ))}
                  {(company.members?.length ?? 0) === 0 ? (
                    <p className="text-sm text-gold-100/75">
                      Noch keine Mitglieder vorhanden.
                    </p>
                  ) : null}
                </div>
              </section>
            </ScrollReveal>
          ) : null}

          {activeTab === "settings" ? (
            <ScrollReveal delayMs={130}>
              <form
                onSubmit={onSubmit}
                className="grid gap-3 rounded-2xl border border-gold-700/55 bg-ink-900/70 p-5"
              >
                <h2 className="text-sm uppercase tracking-[0.3em] text-gold-200">
                  Speditionsdaten bearbeiten
                </h2>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">
                    Name
                  </span>
                  <input
                    value={draftName}
                    onChange={(event) =>
                      setDraftName(event.currentTarget.value)
                    }
                    className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                    placeholder="Speditionsname"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">
                    Tag
                  </span>
                  <input
                    value={draftTag}
                    onChange={(event) => setDraftTag(event.currentTarget.value)}
                    className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                    placeholder="kurzes Tag"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">
                    Land / Code
                  </span>
                  <input
                    value={draftCountryCode}
                    onChange={(event) =>
                      setDraftCountryCode(event.currentTarget.value)
                    }
                    maxLength={3}
                    className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                    placeholder="DE, AT, CH …"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">
                    Beschreibung
                  </span>
                  <textarea
                    value={draftDescription}
                    onChange={(event) =>
                      setDraftDescription(event.currentTarget.value)
                    }
                    rows={4}
                    className="w-full rounded-lg border border-gold-700/50 bg-ink-950/70 px-3 py-2 text-sm text-white"
                    placeholder="Kurze Speditionsbeschreibung"
                  />
                </label>

                <div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="mt-1 inline-flex min-h-11 items-center rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 disabled:opacity-65"
                  >
                    {saving ? "Speichern…" : "Änderungen speichern"}
                  </button>
                </div>
              </form>
            </ScrollReveal>
          ) : null}
        </>
      )}
    </main>
  );
}
