'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { chatApi, type ChatMessage } from '../../../lib/api';

export default function MessagesPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Speditionschat wird geladen…');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const result = await chatApi.list(150);
      setMessages(result.messages);
      setStatus(result.messages.length ? `${result.messages.length} Nachricht(en)` : 'Noch keine Nachrichten in dieser Spedition.');
    } catch {
      setStatus('Chat konnte nicht geladen werden. Prüfe Anmeldung und Speditionszuordnung.');
    }
  }, []);

  useEffect(() => {
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 10000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      await chatApi.send(body);
      setDraft('');
      await loadMessages();
    } catch {
      setStatus('Nachricht konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto grid min-h-[70vh] max-w-5xl grid-rows-[auto_1fr_auto] gap-4 rounded-3xl border border-gold-700/35 bg-ink-900/65 p-4 shadow-2xl sm:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.28em] text-gold-300">Spedition</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-white">Nachrichten</h1>
          <button
            type="button"
            onClick={() => void loadMessages()}
            className="rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-100 transition hover:bg-gold-500/20"
          >
            Aktualisieren
          </button>
        </div>
        <p className="mt-2 text-sm text-gold-200/65">{status}</p>
      </header>

      <div className="min-h-0 space-y-3 overflow-y-auto rounded-2xl border border-ink-700/70 bg-ink-950/70 p-3 sm:p-4">
        {messages.map((message) => (
          <article key={message.id} className="rounded-2xl border border-ink-700/65 bg-ink-900/80 p-4">
            <div className="flex items-center justify-between gap-4">
              <strong className="text-gold-100">{message.sender.displayName}</strong>
              <time className="text-xs text-gold-300/55" dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString('de-DE')}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-100">{message.body}</p>
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="company-chat-message" className="sr-only">
          Nachricht
        </label>
        <input
          id="company-chat-message"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          maxLength={1000}
          placeholder="Nachricht an deine Spedition …"
          className="min-h-12 flex-1 rounded-xl border border-ink-600 bg-ink-950 px-4 text-sm text-white outline-none transition placeholder:text-ink-400 focus:border-gold-500"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="min-h-12 rounded-xl bg-gold-500 px-6 font-semibold text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sende…' : 'Senden'}
        </button>
      </form>
    </section>
  );
}
