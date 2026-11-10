import { Link } from "react-router-dom";
import { product } from "@/config";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold">
      <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" /><path d="M12 8.5v7M8.5 12h7" />
        </svg>
      </span>
      <span>ResQ<span className="text-brand-600 dark:text-brand-400">Net</span></span>
    </Link>
  );
}
