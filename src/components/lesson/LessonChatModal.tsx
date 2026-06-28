"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { MarkdownText } from "@/components/MarkdownText";
import type { LessonChatMessage } from "@/types";

interface LessonChatModalProps {
  lessonId: number;
  learnerId: number;
  lessonTitle: string;
}

export function LessonChatModal({ lessonId, learnerId, lessonTitle }: LessonChatModalProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [messages, setMessages] = useState<LessonChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ learner_id: String(learnerId) });
        const res = await fetch(`/api/lessons/${lessonId}/chat?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          enabled: boolean;
          messages: LessonChatMessage[];
        };
        if (!cancelled) {
          setEnabled(json.enabled);
          setMessages(json.messages);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, loaded, learnerId, lessonId]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    inputRef.current?.focus();
  }, [open, messages.length]);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || sending || !enabled) return;
    setSending(true);
    setError(null);
    setInput("");
    try {
      const res = await fetch(`/api/lessons/${lessonId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learner_id: learnerId, message }),
      });
      const json = (await res.json()) as {
        enabled?: boolean;
        messages?: LessonChatMessage[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (typeof json.enabled === "boolean") setEnabled(json.enabled);
      if (json.messages) setMessages(json.messages);
    } catch (e) {
      setInput(message);
      setError(e instanceof Error ? e.message : "Message failed");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:bottom-6 sm:right-6"
        aria-label="Ask a lesson question"
      >
        <MessageCircle size={21} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/25 sm:bg-transparent"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Lesson questions"
            className="fixed inset-x-2 bottom-2 top-14 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[36rem] sm:w-[25rem] sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900">Ask about this lesson</h2>
                <p className="truncate text-xs text-gray-400">{lessonTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close lesson questions"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
              {loading ? (
                <p className="text-sm text-gray-400">Loading saved conversation...</p>
              ) : messages.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-500">
                  Ask a quick question about the current lesson. Opening and closing this window will not trigger a reply.
                </p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] break-words rounded-2xl px-3 py-2 text-sm leading-6 ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <MarkdownText text={message.content} />
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-400">Thinking...</div>
                </div>
              )}
            </div>

            {error && (
              <div className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            {!enabled && (
              <div className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Lesson chat is not configured on this server.
              </div>
            )}

            <form onSubmit={sendMessage} className="flex shrink-0 items-end gap-2 border-t border-gray-100 p-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || !enabled}
                rows={2}
                placeholder="Ask a quick question..."
                className="min-h-11 flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm leading-5 text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending || !enabled}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send question"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
