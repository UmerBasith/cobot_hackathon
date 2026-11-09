import { Link } from "react-router-dom";
import { product } from "@/config";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold">
      <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-6-6-6M12 19h8" /></svg>
      </span>
      {product.name}
    </Link>
  );
}
