import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { STATIC } from "@/lib/static";

/* ---------------------------------- Modal ---------------------------------- */
export function Modal({ open, onClose, title, children, className }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            className={cn("relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl", className)}
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2 cursor-pointer" aria-label="Close"><X className="size-5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------- Toasts --------------------------------- */
type ToastKind = "success" | "error" | "info" | "warning";
interface Toast { id: number; kind: ToastKind; title: string; text?: string }

const ToastCtx = createContext<(kind: ToastKind, title: string, text?: string) => void>(() => {});
/** const toast = useToast(); toast("success", "Saved", "Your report is ready"); */
export const useToast = () => useContext(ToastCtx);

const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const colors = { success: "text-emerald-500", error: "text-red-500", info: "text-brand-500", warning: "text-amber-500" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: ToastKind, title: string, text?: string) => {
    if (STATIC) return; // no popups in screenshots
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, title, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed top-16 right-4 left-4 z-[60] flex flex-col gap-2 sm:top-auto sm:bottom-4 sm:left-auto sm:w-80">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.kind];
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                className="pointer-events-auto flex gap-3 rounded-xl border border-line bg-surface p-4 shadow-xl">
                <Icon className={cn("mt-0.5 size-5 shrink-0", colors[t.kind])} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.text && <p className="text-sm text-muted">{t.text}</p>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
