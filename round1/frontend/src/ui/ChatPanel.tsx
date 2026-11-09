/**
 * AI assistant chat box. Pass `ask` = async (question, history) => answer text.
 * Default wiring in pages uses POST /api/assistant (backend has a no-key fallback).
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Bot, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ChatMsg { role: "user" | "assistant"; content: string }

export function ChatPanel({ ask, suggestions = [], greeting = "Hi! Ask me anything about your data.", className, title = "AI Assistant" }: {
  ask: (q: string, history: ChatMsg[]) => Promise<string>;
  suggestions?: string[]; greeting?: string; className?: string; title?: string;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([{ role: "assistant", content: greeting }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, busy]);

  async function send(q: string) {
    if (!q.trim() || busy) return;
    const history = [...msgs, { role: "user" as const, content: q.trim() }];
    setMsgs(history); setText(""); setBusy(true);
    try {
      const a = await ask(q.trim(), history);
      setMsgs((m) => [...m, { role: "assistant", content: a }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry, I couldn't reach the server. Please try again." }]);
    } finally { setBusy(false); }
  }

  return (
    <div className={cn("flex h-[480px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft", className)}>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white"><Sparkles className="size-4" /></div>
        <div>
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">● Online</p>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("grid size-7 shrink-0 place-items-center rounded-full",
                m.role === "user" ? "bg-fg text-bg" : "bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200")}>
                {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
              </div>
              <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm bg-surface-2")}>
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex gap-2.5">
            <div className="grid size-7 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200"><Bot className="size-3.5" /></div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-3">
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="size-1.5 rounded-full bg-muted" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: d * 0.15 }} />
              ))}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      {suggestions.length > 0 && msgs.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-brand-300 hover:text-fg cursor-pointer">{s}</button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-center gap-2 border-t border-line p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question..."
          className="h-10 flex-1 rounded-xl bg-surface-2 px-3.5 text-sm outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-brand-500/30" />
        <button type="submit" disabled={busy || !text.trim()} className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-500 disabled:opacity-40 cursor-pointer" aria-label="Send">
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
