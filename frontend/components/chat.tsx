"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ClipboardCopy,
  Mic,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api, streamChat } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import type { CartItem, ChatMessage, Order, OrderDraft, User } from "@/lib/types";
import { cn } from "./ui";
import { Markdown } from "./markdown";

export type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolName?: string | null;
  error?: boolean;
};

const WELCOME: UIMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your AI barista. ☕ I can help you pick drinks, customize your order, or just chat about coffee.\n\nTry: \"two espressos, one double\" or \"what's popular today?\"",
};

let idCounter = 0;
const nextId = () => `m${Date.now()}_${idCounter++}`;

function historyFrom(messages: UIMessage[]): { role: "user" | "assistant"; text: string }[] {
  return messages
    .filter((m) => !m.error)
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.content }));
}

function toUIMessage(m: ChatMessage): UIMessage {
  return { id: m.id, role: m.role, content: m.content, toolName: m.toolName };
}

function toOrderDrafts(raw: unknown): OrderDraft[] {
  const sources = Array.isArray(raw) ? raw : [raw];
  const drafts: OrderDraft[] = [];
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    const entry = src as Record<string, unknown>;
    const item =
      typeof entry.item === "string" ? entry.item : typeof entry.name === "string" ? entry.name : "";
    if (!item.trim()) continue;
    const quantity =
      typeof entry.quantity === "number" && Number.isFinite(entry.quantity) && entry.quantity > 0
        ? entry.quantity
        : 1;
    const draft: OrderDraft = { item: item.trim(), quantity };
    const customization =
      entry.customization && typeof entry.customization === "object"
        ? (entry.customization as Record<string, unknown>)
        : undefined;
    if (customization && typeof customization.size === "string" && customization.size.trim()) {
      draft.size = customization.size.trim();
    }
    if (customization && typeof customization.milk === "string" && customization.milk.trim()) {
      draft.milk = customization.milk.trim();
    }
    if (customization && Array.isArray(customization.toppings)) {
      const toppings = customization.toppings.filter(
        (t): t is string => typeof t === "string" && Boolean(t.trim()),
      );
      if (toppings.length) draft.toppings = toppings.map((t) => t.trim());
    }
    drafts.push(draft);
  }
  return drafts;
}

type ChatProps = {
  activeSessionId: string | null;
  onSessionChange: (id: string | null) => void;
  onDraft: (drafts: OrderDraft[]) => void;
  onNotice: (text: string) => void;
  onOrderCreated?: (order: Order) => void;
  onOrderCancelled?: (order: Order) => void;
  onOrderStatus?: (order: Order) => void;
  onCartState?: (cart: CartItem[]) => void;
};

export function Chat({
  activeSessionId,
  onSessionChange,
  onDraft,
  onNotice,
  onOrderCreated,
  onOrderCancelled,
  onOrderStatus,
  onCartState,
}: ChatProps) {
  const { user, devEmail } = useAuth();
  const [messages, setMessages] = useState<UIMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef(false);

  const log = useCallback((...args: unknown[]) => {
    console.info("[chat]", ...args);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (!user) return;
      try {
        const msgs = await api.sessionMessages(devEmail, sessionId);
        setMessages(msgs.length ? msgs.map(toUIMessage) : [WELCOME]);
      } catch {
        onNotice("Could not load that session.");
      }
    },
    [user, devEmail, onNotice],
  );

  useEffect(() => {
    if (activeSessionId && !streamingRef.current) void loadSession(activeSessionId);
  }, [activeSessionId, loadSession]);

  const send = useCallback(
    async (raw: string, historyOverride?: { role: "user" | "assistant"; text: string }[]) => {
      const text = raw.trim();
      if (!text || streaming || !user) return;
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const userMsg: UIMessage = { id: nextId(), role: "user", content: text };
      const botMsg: UIMessage = {
        id: nextId(),
        role: "assistant",
        content: "",
        error: false,
      };
      setMessages((prev) => [...prev, userMsg, botMsg]);
      setStreaming(true);
      streamingRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      log("send", { text, historyLen: historyOverride?.length ?? messages.length, botMsgId: botMsg.id });

      try {
        await streamChat(
          devEmail,
          text,
          historyOverride ?? historyFrom(messages),
          (ev) => {
            if (ev.event === "start") {
              log("start", { sessionId: ev.data.sessionId });
              onSessionChange(ev.data.sessionId);
            } else if (ev.event === "tool") {
              log("tool", { title: ev.data.title, textLen: ev.data.text?.length });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsg.id
                    ? { ...m, content: ev.data.text, toolName: ev.data.title }
                    : m,
                ),
              );
            } else if (ev.event === "delta") {
              setMessages((prev) => {
                let applied = false;
                const next = prev.map((m) => {
                  if (m.id !== botMsg.id) return m;
                  applied = true;
                  return { ...m, content: m.content + ev.data.text };
                });
                if (!applied) log("delta dropped", { botMsgId: botMsg.id, text: ev.data.text });
                return next;
              });
            } else if (ev.event === "order") {
              log("order", { draft: ev.data.draft });
              const drafts = toOrderDrafts(ev.data.draft);
              if (drafts.length) onDraft(drafts);
            } else if (
              ev.event === "orderCreated" ||
              ev.event === "orderCancelled" ||
              ev.event === "orderStatus" ||
              ev.event === "orderState" ||
              ev.event === "orderText"
            ) {
              const text = ev.data.text ?? "";
              log(ev.event, { textLen: text?.length });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsg.id
                    ? { ...m, content: text, toolName: "Order" }
                    : m,
                ),
              );
              if (ev.event === "orderCreated") onOrderCreated?.(ev.data.order);
              else if (ev.event === "orderCancelled") onOrderCancelled?.(ev.data.order);
              else if (ev.event === "orderStatus") onOrderStatus?.(ev.data.order);
              else if (ev.event === "orderState") onCartState?.(ev.data.cart);
            } else if (ev.event === "done") {
              log("done", { replyKind: ev.data.replyKind, textLen: ev.data.text?.length });
              setMessages((prev) => {
                const found = prev.some((m) => m.id === botMsg.id);
                if (found) return prev;
                return [
                  ...prev,
                  ev.data.replyKind === "error"
                    ? { id: botMsg.id, role: "assistant", content: ev.data.text, error: true }
                    : { id: botMsg.id, role: "assistant", content: ev.data.text },
                ];
              });
            } else if (ev.event === "error") {
              log("error", { message: ev.data.message });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsg.id
                    ? { ...m, content: ev.data.message, error: true }
                    : m,
                ),
              );
            }
          },
          controller.signal,
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          log("stream failed", e);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsg.id
                ? { ...m, content: "I'm having trouble connecting right now. Please try again.", error: true }
                : m,
            ),
          );
        }
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [user, devEmail, streaming, messages, onDraft, onOrderCreated, onOrderCancelled, onOrderStatus, onCartState, onSessionChange, log],
  );

  const regenerate = useCallback(async () => {
    if (streaming) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const trimmed = [...messages];
    while (trimmed.length && trimmed[trimmed.length - 1].role === "assistant") {
      trimmed.pop();
    }
    setMessages(trimmed);
    void send(lastUser.content, historyFrom(trimmed));
  }, [messages, send, streaming]);

  const copyText = useCallback(async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const toggleVoice = useCallback(() => {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: (e: { results: { length: number; [k: number]: { [j: number]: { transcript: string } } } }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };
    const Recognition = w.webkitSpeechRecognition;
    if (!Recognition) {
      onNotice("Voice input isn't supported in this browser yet.");
      return;
    }
    if (listening) {
      setListening(false);
      return;
    }
    const rec = new Recognition();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, onNotice]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (file.type.startsWith("text/") || file.type.includes("json")) {
        const text = await file.text();
        setInput((prev) => (prev ? `${prev}\n${text.slice(0, 2000)}` : text.slice(0, 2000)));
      } else {
        onNotice("Image upload isn't wired up yet — drop a text file instead.");
      }
    },
    [onNotice],
  );

  const isFresh = messages.length === 1 && messages[0].id === "welcome";

  const SUGGESTIONS = [
    "Recommend a cold coffee",
    "Two espressos, one double",
    "What's popular today?",
    "Tell me a joke",
  ];

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-[var(--brand)]/60 bg-[var(--brand)]/10 backdrop-blur-sm">
          <p className="text-sm font-semibold text-[var(--brand)]">Drop file to add to your message</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                copied={copied === m.id}
                onCopy={() => void copyText(m.id, m.content)}
                onRegenerate={regenerate}
              />
            ))}
          </AnimatePresence>
          {streaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2.5 pl-11 text-xs text-[var(--muted)]"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--brand)]/60" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--brand)]" />
              </span>
              brewing…
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-4 py-4">
        <div className="mx-auto max-w-3xl">
          {isFresh && !streaming && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 flex flex-wrap justify-center gap-2"
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="rounded-full border border-[var(--border)] bg-[var(--panel)]/70 px-3.5 py-1.5 text-xs font-medium text-[var(--secondary)] transition-all hover:border-[var(--brand)]/50 hover:text-[var(--brand-hover)] hover:shadow-[0_0_16px_-4px_rgba(201,134,66,0.5)]"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}
          <div className="group relative flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-2 shadow-lg shadow-black/30 backdrop-blur transition-all focus-within:border-[var(--brand)]/50 focus-within:shadow-[0_0_24px_-6px_rgba(201,134,66,0.5)]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={
                streaming ? "Barista is brewing…" : "Message your barista (Enter to send)"
              }
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none"
              disabled={streaming}
            />
            <button
              onClick={toggleVoice}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl transition-colors",
                listening
                  ? "bg-red-500/15 text-red-400 animate-pulse"
                  : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]",
              )}
              title="Voice input"
            >
              <Mic className="size-4" />
            </button>
            <button
              onClick={() => void send(input)}
              disabled={streaming || !input.trim()}
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#d89b5c] to-[#a96a2e] text-white shadow-md shadow-[var(--brand)]/40 transition-all hover:shadow-[var(--brand)]/60 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:shadow-none"
              title="Send"
            >
              <Send className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
            {(user?.role as User["role"] | undefined) === "admin"
              ? "Admin workspace · full access"
              : "Menu answers are from the live catalog · AI may be wrong"}
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  copied,
  onCopy,
  onRegenerate,
}: {
  message: UIMessage;
  copied: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold shadow-md",
          isUser
            ? "bg-gradient-to-br from-[#d89b5c] to-[#8a4f1f] text-white shadow-[var(--brand)]/30"
            : "border border-emerald-500/25 bg-emerald-500/15 text-emerald-400",
        )}
      >
        {isUser ? "You" : <Sparkles className="size-3.5" />}
      </div>
      <div
        className={cn(
          "group min-w-0 max-w-[80%] rounded-2xl px-4 py-2.5",
          isUser
            ? "rounded-tr-sm bg-gradient-to-br from-[#d89b5c] to-[#a96a2e] text-white shadow-lg shadow-[var(--brand)]/25"
            : "rounded-tl-sm border border-[var(--border)] bg-[var(--panel)]/70 backdrop-blur",
          message.error && "border-red-500/30 bg-red-500/[0.06]",
        )}
      >
        {!isUser && message.toolName && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--brand-hover)]">
            <Sparkles className="size-3" />
            {message.toolName}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{message.content}</p>
        ) : message.content ? (
          <Markdown>{message.content}</Markdown>
        ) : (
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="size-1.5 animate-bounce rounded-full bg-[var(--brand)]" />
            <span className="size-1.5 animate-bounce rounded-full bg-[var(--brand)] [animation-delay:120ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-[var(--brand)] [animation-delay:240ms]" />
          </div>
        )}
        {!isUser && message.content && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onCopy}
              className="grid size-6 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
              title="Copy"
            >
              {copied ? <Check className="size-3" /> : <ClipboardCopy className="size-3" />}
            </button>
            <button
              onClick={onRegenerate}
              className="grid size-6 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
              title="Regenerate"
            >
              <RefreshCw className="size-3" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
