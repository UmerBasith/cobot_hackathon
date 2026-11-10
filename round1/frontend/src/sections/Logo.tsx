import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

/** The ResQNet "R+" brand mark (public/images/logo-mark.png, transparent background). */
export function BrandMark({ className, tile = false }: { className?: string; tile?: boolean }) {
  const img = <img src="/images/logo-mark.png" alt="ResQNet" className={cn("h-9 w-auto select-none", !tile && className)} draggable={false} />;
  // On dark backgrounds put the mark on a white tile so its navy half stays visible.
  return tile ? <span className={cn("grid place-items-center rounded-xl bg-white p-1.5 shadow-lg", className)}>{img}</span> : img;
}

export const NAVY = "#1b2a4e";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold" style={{ color: NAVY }}>
      <BrandMark className="h-8" />
      ResQNet
    </Link>
  );
}
