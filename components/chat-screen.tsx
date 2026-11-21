"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { ChatMessage, ChatSummary, ModelOption, PublicUser } from "@/lib/types";

export function ChatScreen() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelError, setModelError] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [modelId, setModelId] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopNav, setDesktopNav] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await api<{ user: PublicUser }>("/auth/me");
        if (cancelled) {
          return;
        }
        setUser(me.user);
        const [modelResult, chatResult] = await Promise.all([
          api<{ models: ModelOption[] }>("/models").catch((caught: unknown) => {
            setModelError(caught instanceof ApiError ? caught.message : "Models could not be loaded.");
            return { models: [] as ModelOption[] };
          }),
          api<{ chats: ChatSummary[] }>("/chats"),
        ]);
        if (cancelled) {
          return;
        }
        setModels(modelResult.models);
        setModelId(modelResult.models[0]?.id ?? "");
        setChats(chatResult.chats);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError(caught instanceof ApiError ? caught.message : "Could not load the chat.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (stickRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, sending]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      setDesktopNav(media.matches);
      if (media.matches) {
        setSidebarOpen(false);
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  async function openChat(chat: ChatSummary) {
    setActiveId(chat.id);
    setSidebarOpen(false);
    setError("");
    setPendingDelete(null);
    if (chat.modelId && models.some((model) => model.id === chat.modelId)) {
      setModelId(chat.modelId);
    }
    const result = await api<{ messages: ChatMessage[] }>(`/chats/${chat.id}/messages`);
    setMessages(result.messages);
  }

  async function createChat() {
    setError("");
    const created = await api<{ chat: ChatSummary }>("/chats", {
      method: "POST",
      body: JSON.stringify(modelId ? { modelId } : {}),
    });
    setChats((current) => [created.chat, ...current.filter((chat) => chat.id !== created.chat.id)]);
    setActiveId(created.chat.id);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function removeChat(chatId: string) {
    await api(`/chats/${chatId}`, { method: "DELETE" });
    setChats((current) => current.filter((chat) => chat.id !== chatId));
    if (activeId === chatId) {
      setActiveId(null);
      setMessages([]);
    }
    setPendingDelete(null);
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    setChats([]);
    setMessages([]);
    setActiveId(null);
    router.replace("/login");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || !modelId) {
      return;
    }
    setSending(true);
    setError("");
    const clientRequestId = crypto.randomUUID();
    let chatId = activeId;
    try {
      if (!chatId) {
        const created = await api<{ chat: ChatSummary }>("/chats", {
          method: "POST",
          body: JSON.stringify({ modelId }),
        });
        chatId = created.chat.id;
        setActiveId(chatId);
        setChats((current) => [created.chat, ...current]);
      }
      const sendOnce = () =>
        api<{ messages: ChatMessage[]; chat: ChatSummary }>(`/chats/${chatId}/messages`, {
          method: "POST",
          body: JSON.stringify({ content, modelId, clientRequestId }),
        });
      let result: { messages: ChatMessage[]; chat: ChatSummary };
      try {
        result = await sendOnce();
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 0) {
          result = await sendOnce();
        } else {
          throw caught;
        }
      }
      setDraft("");
      setMessages((current) => mergeMessages(current, result.messages));
      setChats((current) =>
        [result.chat, ...current.filter((chat) => chat.id !== result.chat.id)].sort((a, b) =>
          a.updatedAt < b.updatedAt ? 1 : -1,
        ),
      );
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "The message could not be sent.";
      setError(message);
      if (chatId) {
        const latest = await api<{ messages: ChatMessage[] }>(`/chats/${chatId}/messages`).catch(() => null);
        if (latest) {
          setMessages(latest.messages);
        }
      }
    } finally {
      setSending(false);
    }
  }

  const modelsReady = models.length > 0 && !modelError;

  return (
    <div className="flex h-dvh min-h-0 justify-center overflow-hidden bg-[#141210] p-0 text-[#f4efe6] sm:p-3 md:p-5">
      <div className="flex h-full min-h-0 w-full max-w-4xl overflow-hidden bg-[#1c1916] sm:rounded-2xl sm:border sm:border-[#e7d7c3]/15 sm:shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        id="sidebar"
        inert={!desktopNav && !sidebarOpen}
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-30 flex h-dvh w-[min(14.5rem,82vw)] flex-col border-r border-[#e7d7c3]/10 bg-[#171512] p-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]! pb-[max(0.5rem,env(safe-area-inset-bottom))]! shadow-2xl transition-transform duration-200 md:static md:z-auto md:h-auto md:w-56 md:translate-x-0 md:pt-2.5! md:pb-2.5! md:shadow-none`}
      >
        <div className="flex items-center justify-between gap-2 px-1.5 py-1">
          <div className="text-sm font-medium tracking-wide text-[#e7d7c3]">Harbor</div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#e7d7c3] hover:bg-white/5 md:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => void createChat()}
          className="mt-1.5 min-h-9 rounded-md border border-[#e7d7c3]/20 px-2.5 py-1.5 text-left text-sm text-[#f4efe6] hover:bg-[#e7d7c3]/10 focus-visible:outline focus-visible:outline-2"
        >
          New chat
        </button>
        <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto">
          {chats.length === 0 ? <p className="px-2 text-xs text-[#a3988c]">No chats yet.</p> : null}
          {chats.map((chat) => (
            <div key={chat.id} className={`rounded-md ${chat.id === activeId ? "bg-[#e7d7c3]/15" : "hover:bg-white/5"}`}>
              <div className="flex min-w-0 items-center">
                <button
                  type="button"
                  onClick={() => void openChat(chat)}
                  className="min-h-9 min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-xs focus-visible:outline focus-visible:outline-2"
                >
                  {chat.title}
                </button>
                {pendingDelete === chat.id ? null : (
                  <button
                    type="button"
                    className="min-h-9 shrink-0 px-2 text-[11px] text-[#a3988c]"
                    onClick={() => setPendingDelete(chat.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
              {pendingDelete === chat.id ? (
                <div className="flex gap-2 px-2.5 pb-1.5 text-[11px]">
                  <button type="button" className="min-h-8 text-red-300" onClick={() => void removeChat(chat.id)}>
                    Confirm delete
                  </button>
                  <button type="button" className="min-h-8" onClick={() => setPendingDelete(null)}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="border-t border-[#e7d7c3]/10 pt-2">
          <p className="truncate px-1.5 text-xs text-[#a3988c]">{user?.email}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-1 min-h-9 w-full rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col bg-[#221f1b]">
        <header className="flex min-w-0 items-center gap-2 border-b border-[#e7d7c3]/10 px-2.5 py-1.5 pt-[max(0.4rem,env(safe-area-inset-top))] md:pt-1.5">
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#e7d7c3]/20 md:hidden"
            aria-label="Open sidebar"
            aria-expanded={sidebarOpen}
            aria-controls="sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <label className="sr-only" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={!modelsReady}
            className="min-w-0 flex-1 truncate rounded-md border border-[#e7d7c3]/15 bg-[#141210] px-2 py-1 text-base text-[#f4efe6] sm:max-w-52 sm:flex-none sm:text-xs"
          >
            {models.length === 0 ? <option value="">No models available</option> : null}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </select>
        </header>
        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5"
          onScroll={(event) => {
            const node = event.currentTarget;
            stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
          }}
        >
          <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-2">
            {!activeId && messages.length === 0 ? (
              <p className="mx-auto mt-10 max-w-xs text-center text-sm text-[#a3988c]">Start a new chat and send a message.</p>
            ) : null}
            {modelError ? <p className="text-sm text-red-300">{modelError}</p> : null}
            {models.length === 0 && !modelError ? (
              <p className="text-center text-sm text-[#a3988c]">No enabled models are configured. Ask an administrator to run the model seed.</p>
            ) : null}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`min-w-0 w-fit max-w-[90%] rounded-lg px-2.5 py-1.5 text-sm leading-5 sm:max-w-[80%] ${message.role === "user" ? "ml-auto bg-[#6b4b32] text-[#fff7ee]" : "mr-auto border border-[#e7d7c3]/10 bg-[#2a2622]"}`}
              >
                <p className="mb-0.5 text-[10px] uppercase tracking-wide text-[#cbbba8]">{message.role}</p>
                {message.status === "failed" ? (
                  <p className="text-red-300">The assistant could not generate a response.</p>
                ) : message.role === "assistant" ? (
                  <div className="markdown min-w-0 text-sm leading-5">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
                )}
              </article>
            ))}
            {sending ? <p className="text-xs text-[#a3988c]">Sending...</p> : null}
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div ref={bottomRef} />
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          className="px-2.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4"
        >
          <div className="mx-auto flex w-full max-w-2xl min-w-0 items-end gap-1.5 rounded-xl border border-[#e7d7c3]/15 bg-[#141210] p-1.5">
            <label className="sr-only" htmlFor="composer">
              Message
            </label>
            <textarea
              id="composer"
              rows={1}
              value={draft}
              placeholder="Send a message"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="max-h-28 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-[#a3988c] sm:text-sm"
            />
            <button
              type="submit"
              disabled={sending || !modelsReady || draft.trim().length === 0}
              className="mb-0.5 min-h-8 shrink-0 rounded-lg bg-[#e7d7c3] px-3 text-xs font-medium text-[#2a2118] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </section>
      </div>
    </div>
  );
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}
