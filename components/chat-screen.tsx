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
    <div className="flex h-dvh min-h-0 bg-[#0f1115] text-zinc-100">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed z-30 flex h-dvh w-72 flex-col border-r border-white/10 bg-[#171717] p-3 transition-transform md:static md:translate-x-0`}
      >
        <div className="px-2 py-2 text-lg font-semibold">Harbor Chat</div>
        <button
          type="button"
          onClick={() => void createChat()}
          className="mt-2 rounded-lg border border-white/10 px-3 py-2 text-left hover:bg-white/5 focus-visible:outline focus-visible:outline-2"
        >
          New chat
        </button>
        <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
          {chats.length === 0 ? <p className="px-2 text-sm text-zinc-500">No chats yet.</p> : null}
          {chats.map((chat) => (
            <div key={chat.id} className={`rounded-lg ${chat.id === activeId ? "bg-white/10" : "hover:bg-white/5"}`}>
              <button
                type="button"
                onClick={() => void openChat(chat)}
                className="w-full truncate px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2"
              >
                {chat.title}
              </button>
              {pendingDelete === chat.id ? (
                <div className="flex gap-2 px-3 pb-2 text-xs">
                  <button type="button" className="text-red-300" onClick={() => void removeChat(chat.id)}>
                    Confirm delete
                  </button>
                  <button type="button" onClick={() => setPendingDelete(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="px-3 pb-2 text-xs text-zinc-500"
                  onClick={() => setPendingDelete(chat.id)}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-3">
          <p className="truncate px-2 text-sm text-zinc-400">{user?.email}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
          <button
            type="button"
            className="rounded-md border border-white/10 px-2 py-1 md:hidden"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            Menu
          </button>
          <label className="sr-only" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={!modelsReady}
            className="max-w-full rounded-lg border border-white/10 bg-black px-2 py-1 text-sm"
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
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
          onScroll={(event) => {
            const node = event.currentTarget;
            stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
          }}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {!activeId && messages.length === 0 ? (
              <p className="text-zinc-400">Start a new chat and send a message.</p>
            ) : null}
            {modelError ? <p className="text-red-300">{modelError}</p> : null}
            {models.length === 0 && !modelError ? (
              <p className="text-zinc-400">No enabled models are configured. Ask an administrator to run the model seed.</p>
            ) : null}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === "user" ? "ml-auto bg-[#2f2f2f]" : "mr-auto bg-transparent"}`}
              >
                <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{message.role}</p>
                {message.status === "failed" ? (
                  <p className="text-red-300">The assistant could not generate a response.</p>
                ) : message.role === "assistant" ? (
                  <div className="break-words">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </article>
            ))}
            {sending ? <p className="text-sm text-zinc-400">Sending...</p> : null}
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <div ref={bottomRef} />
          </div>
        </div>
        <form onSubmit={onSubmit} className="border-t border-white/10 p-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <label className="sr-only" htmlFor="composer">
              Message
            </label>
            <textarea
              id="composer"
              rows={2}
              value={draft}
              placeholder="Send a message"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="max-h-40 min-h-12 flex-1 resize-y rounded-xl border border-white/10 bg-black px-3 py-2 outline-none focus-visible:border-white"
            />
            <button
              type="submit"
              disabled={sending || !modelsReady || draft.trim().length === 0}
              className="rounded-xl bg-white px-4 py-2 font-medium text-black disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </section>
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
