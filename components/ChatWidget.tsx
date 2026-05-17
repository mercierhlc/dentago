"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Message {
  id: string;
  role: "visitor" | "agent";
  content: string;
  created_at: string;
}

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("dg_visitor_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("dg_visitor_id", id);
  }
  return id;
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [stage, setStage] = useState<"idle" | "intro" | "chat">("idle");
  const [visitorName, setVisitorName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (open && stage === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, stage]);

  // Subscribe to realtime messages once we have a session
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.role === "agent" && !open) setHasUnread(true);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, open]);

  // Clear unread when opened
  useEffect(() => {
    if (open) setHasUnread(false);
  }, [open]);

  const startSession = useCallback(async (name: string) => {
    const visitor_id = getOrCreateVisitorId();
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id, page_url: window.location.pathname, name }),
    });
    const data = await res.json();
    if (data.session_id) {
      setSessionId(data.session_id);
      setStage("chat");
      // Fetch existing messages if resuming
      const mRes = await fetch(`/api/chat/messages?session_id=${data.session_id}`);
      const mData = await mRes.json();
      setMessages(mData.messages ?? []);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    if (stage === "idle") setStage("intro");
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim() || "Visitor";
    setVisitorName(name);
    await startSession(name);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic
    const optimistic: Message = { id: crypto.randomUUID(), role: "visitor", content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);

    await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, content: text, role: "visitor" }),
    });
    setSending(false);
    inputRef.current?.focus();
  };

  if (pathname?.startsWith("/os")) return null;
  /** Founder strategic OS — distraction-free command center */
  if (pathname?.startsWith("/bdo")) return null;
  /* Focused onboarding — avoid floating UI over forms (browser autofill chips are enough noise). */
  if (pathname === "/signup/finish" || pathname === "/signup/welcome" || pathname === "/signup/demo" || pathname === "/dashboard/onboarding") return null;

  return (
    <>
      {/* Chat window */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ maxHeight: "70vh" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#111111" }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Dentago Support</p>
              <p className="text-xs text-purple-200">Typically replies within minutes</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Intro / name capture */}
          {stage === "intro" && (
            <div className="flex-1 p-5 flex flex-col gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-[#0D0B1E] mb-1">Hey there! 👋</p>
                <p className="text-sm text-slate-600">Welcome to Dentago. What&apos;s your name?</p>
              </div>
              <form onSubmit={handleNameSubmit} className="flex flex-col gap-3">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#111111" }}
                >
                  Start chat
                </button>
              </form>
            </div>
          )}

          {/* Chat messages */}
          {stage === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {/* Welcome message */}
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: "#111111" }}>D</div>
                  <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                    <p className="text-sm text-slate-700">Hi{visitorName ? ` ${visitorName}` : ""}! 👋 How can I help you today?</p>
                  </div>
                </div>

                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-2 ${m.role === "visitor" ? "flex-row-reverse" : ""}`}>
                    {m.role === "agent" && (
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: "#111111" }}>D</div>
                    )}
                    <div className={`px-3 py-2 rounded-2xl max-w-[80%] text-sm ${
                      m.role === "visitor"
                        ? "text-white rounded-tr-sm"
                        : "bg-slate-50 text-slate-700 rounded-tl-sm"
                    }`} style={m.role === "visitor" ? { background: "#111111" } : {}}>
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} className="border-t border-slate-100 p-3 flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-0"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="px-3 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-40 transition-opacity hover:opacity-90 flex-shrink-0"
                  style={{ background: "#111111" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={handleOpen}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: "#111111" }}
        aria-label="Open chat"
      >
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
        {hasUnread && !open && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </>
  );
}
