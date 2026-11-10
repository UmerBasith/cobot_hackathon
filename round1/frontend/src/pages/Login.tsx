/**
 * /admin/login and /responder/login — role-based sign-in (demo credentials shown on the page).
 * RequireRole guards /admin/* and /responder: no session -> redirect to that role's login.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Loader2, LockKeyhole, MonitorCog, Truck, UserRound } from "lucide-react";
import { DEMO, getSession, login, type Role } from "@/lib/auth";
import { getTeams } from "@/lib/resq";
import type { Team } from "@/lib/mock";
import { cn } from "@/lib/cn";

const RED = "#e53935";
const NAVY = "#1b2a4e";

/** Redirects to the role's login page when there is no valid session. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const loc = useLocation();
  if (getSession(role)) return <>{children}</>;
  const next = encodeURIComponent(loc.pathname + loc.search);
  return <Navigate to={`/${role}/login?next=${next}`} replace />;
}

const COPY: Record<Role, { title: string; sub: string; icon: typeof MonitorCog; home: string }> = {
  admin: { title: "Control Room", sub: "Sign in to monitor, prioritise and dispatch.", icon: MonitorCog, home: "/admin" },
  responder: { title: "Responder", sub: "Sign in with your team to see your assignments.", icon: Truck, home: "/responder" },
};

export default function Login({ role }: { role: Role }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const c = COPY[role];
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [team, setTeam] = useState("");
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (role === "responder") getTeams().then(setTeams).catch(() => setTeams([])); }, [role]);

  /** Where to go after sign-in: the page the user was trying to open, else the role's home. */
  function target(teamId?: string) {
    const next = params.get("next");
    const t = next && next.startsWith(`/${role}`) && !next.includes("/login") ? next : c.home;
    return role === "responder" && teamId && !t.includes("team=") ? `${t}${t.includes("?") ? "&" : "?"}team=${teamId}` : t;
  }
  const session = getSession(role);
  if (session) return <Navigate to={target(session.team)} replace />;

  function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const t = teams?.find((x) => x.id === team);
    const s = login(role, { id, pin, team, teamName: t ? `${t.type_label} · ${t.station}` : undefined });
    setBusy(false);
    if (!s) { setErr(role === "admin" ? "Wrong Admin ID or PIN." : team ? "Wrong PIN." : "Choose your team."); return; }
    nav(target(s.team), { replace: true });
  }

  const field = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15";

  return (
    <div className="grid min-h-screen bg-[#f6f8fc] lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden overflow-hidden lg:block" style={{ background: `linear-gradient(150deg, ${NAVY}, #0b1736 60%, #3b0d0c)` }}>
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-red-500/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-white p-2 pr-4 shadow-lg">
            <img src="/images/logo-mark.png" alt="" className="h-8" /><b style={{ color: NAVY }}>ResQNet</b>
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-red-300 uppercase">{role === "admin" ? "Admin Control Room" : "Field Responder"}</p>
            <h1 className="mt-3 font-display text-4xl leading-tight font-bold">From report to rescue,<br />every second counts.</h1>
            <p className="mt-4 max-w-md text-slate-300">{role === "admin" ? "Live map, explainable priorities and one-click dispatch for the whole city." : "Your assignments, directions and status updates in one place."}</p>
          </div>
          <p className="text-xs text-slate-400">Citizens never need to sign in — reporting stays open to everyone.</p>
        </div>
      </div>

      {/* form */}
      <div className="flex items-center justify-center p-5">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center">
            <img src="/images/logo-full.png" alt="ResQNet — Citizen Emergency Platform" className="h-28 w-auto" />
          </div>
          <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-red-50" style={{ color: RED }}><c.icon className="size-5" /></span>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">{c.title} sign in</h2>
                <p className="text-sm text-slate-500">{c.sub}</p>
              </div>
            </div>

            {role === "admin" ? (
              <label className="mb-4 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><UserRound className="size-4" />Admin ID</span>
                <input className={field} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="admin" autoFocus />
              </label>
            ) : (
              <label className="mb-4 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Truck className="size-4" />Your team</span>
                <select className={cn(field, "cursor-pointer")} value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="">{teams ? "Select your team…" : "Loading teams…"}</option>
                  {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.type_label} · {t.station} ({t.id})</option>)}
                </select>
              </label>
            )}

            <label className="mb-2 block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><KeyRound className="size-4" />PIN</span>
              <input className={cn(field, "tracking-[0.4em]")} type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="current-password" placeholder="••••" />
            </label>

            {err && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}

            <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white shadow-lg shadow-red-500/25 transition hover:opacity-95 disabled:opacity-60" style={{ background: RED }}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : <LockKeyhole className="size-5" />}Sign in
            </button>

            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <b>Demo access</b> · {role === "admin" ? <>Admin ID <code className="font-mono font-bold">{DEMO.admin.id}</code> · PIN <code className="font-mono font-bold">{DEMO.admin.pin}</code></> : <>any team · PIN <code className="font-mono font-bold">{DEMO.responder.pin}</code></>}
            </div>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/" className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" />Citizen site</Link>
            <Link to={role === "admin" ? "/responder/login" : "/admin/login"} className="font-medium text-blue-700 hover:underline">
              {role === "admin" ? "Responder sign in" : "Control room sign in"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
