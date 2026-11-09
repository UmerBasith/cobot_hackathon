import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { /* private mode */ }
  }, [dark]);
  return (
    <button onClick={() => setDark((d) => !d)} aria-label="Toggle theme"
      className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:text-fg cursor-pointer">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
